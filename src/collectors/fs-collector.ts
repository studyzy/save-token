import type {
  ConfigFileSummary,
  HookEntry,
  McpEntry,
  PluginEntry,
  SkillEntry,
} from '../types'
import { MCP_CLI_ALTERNATIVES, LOW_FREQUENCY_PLUGINS } from '../types'
import type { PlatformAdapter } from '../adapters/platform-adapter'
import { exists, getStats, readDir, readFile, isDirectory } from '../utils/fs-operations'
import { estimate, estimateMcpTokens, impactLevel } from './token-estimator'

export interface FsCollectResult {
  mcpList: McpEntry[]
  skillList: SkillEntry[]
  pluginList: PluginEntry[]
  hookList: HookEntry[]
  configFiles: ConfigFileSummary[]
  codebuddyMdSize: number
  historySize: number
}

interface McpConfigFile {
  mcpServers?: Record<string, McpServerConfig>
  disabledMcpServers?: string[]
}

interface McpServerConfig {
  type?: string
  command?: string
  url?: string
  args?: string[]
  defer_loading?: boolean
  tools?: Record<string, { defer_loading?: boolean }>
}

interface SettingsFile {
  enabledPlugins?: Record<string, boolean>
  hooks?: Record<string, Array<HookConfig>>
  model?: string
  deferToolLoading?: boolean
  reasoningEffort?: string
}

interface HookConfig {
  matcher?: string
  hooks?: Array<{ type: string; command: string; timeout?: number }>
}

/**
 * Scan CodeBuddy config directory via filesystem and assemble structured results.
 */
export function scanFilesystem(adapter: PlatformAdapter): FsCollectResult {
  const paths = adapter.getConfigPaths()

  const mcpList = scanMcpConfig(paths.mcp)
  const settings = readSettings(paths.settings)
  const pluginList = scanPlugins(settings)
  const hookList = scanHooks(settings)
  const skillList = scanSkills(paths.skillsDir, 'user')
  const projectSkills = scanSkills(`${process.cwd()}/.codebuddy/skills`, 'project')
  const marketplaceSkills = scanMarketplaceSkills(paths.pluginsMarketplacesDir, settings)
  // CodeBuddy shows commands alongside skills in /context as "Skills and slash commands"
  const userCommands = scanCommandsAsSkills(paths.commandsDir, 'user')
  const projectCommands = scanCommandsAsSkills(`${process.cwd()}/.codebuddy/commands`, 'project')
  const allSkills = [...skillList, ...projectSkills, ...marketplaceSkills, ...userCommands, ...projectCommands]

  const configFiles: ConfigFileSummary[] = []
  for (const file of [paths.codebuddyMd, paths.settings, paths.mcp]) {
    configFiles.push(summarizeFile(file))
  }
  const codebuddyMdSize = configFiles.find(c => c.path === paths.codebuddyMd)?.sizeBytes ?? 0
  const historySize = summarizeFile(paths.historyFile).sizeBytes

  return {
    mcpList,
    skillList: allSkills,
    pluginList,
    hookList,
    configFiles,
    codebuddyMdSize,
    historySize,
  }
}

function readJsonSafe<T>(path: string): T | null {
  if (!exists(path)) return null
  try {
    return JSON.parse(readFile(path)) as T
  } catch {
    return null
  }
}

function scanMcpConfig(path: string): McpEntry[] {
  const config = readJsonSafe<McpConfigFile>(path)
  if (!config) return []
  const entries: McpEntry[] = []
  const disabled = new Set(config.disabledMcpServers ?? [])

  for (const [name, server] of Object.entries(config.mcpServers ?? {})) {
    const cliAlt = MCP_CLI_ALTERNATIVES[name]
    const configStr = JSON.stringify(server)
    entries.push({
      name,
      status: disabled.has(name) ? 'disabled' : 'enabled',
      type: (server.type as 'stdio' | 'sse' | 'http') ?? 'stdio',
      command: server.command,
      url: server.url,
      toolsCount: null,
      deferLoading: !!server.defer_loading,
      source: 'user',
      estimatedTokens: estimateMcpTokens(null, configStr.length),
      hasCliAlternative: !!cliAlt,
      cliAlternative: cliAlt,
    })
  }
  return entries
}

function readSettings(path: string): SettingsFile {
  return readJsonSafe<SettingsFile>(path) ?? {}
}

function scanPlugins(settings: SettingsFile): PluginEntry[] {
  const entries: PluginEntry[] = []
  for (const [id, enabled] of Object.entries(settings.enabledPlugins ?? {})) {
    const [pluginId, marketplace] = id.split('@')
    entries.push({
      id,
      pluginId: pluginId ?? id,
      marketplace: marketplace ?? 'unknown',
      enabled: !!enabled,
      installedPath: null,
      isLowFrequency: LOW_FREQUENCY_PLUGINS.has(id),
    })
  }
  return entries
}

function scanHooks(settings: SettingsFile): HookEntry[] {
  const entries: HookEntry[] = []
  for (const [event, hooks] of Object.entries(settings.hooks ?? {})) {
    for (const cfg of hooks ?? []) {
      const matcher = cfg.matcher ?? '*'
      for (const h of cfg.hooks ?? []) {
        entries.push({
          event,
          matcher,
          command: h.command,
          timeout: h.timeout ?? null,
          source: 'settings',
        })
      }
    }
  }
  return entries
}

function scanSkills(dir: string, source: SkillEntry['source']): SkillEntry[] {
  if (!exists(dir) || !isDirectory(dir)) return []
  const entries: SkillEntry[] = []
  for (const name of readDir(dir)) {
    const skillDir = `${dir}/${name}`
    if (!isDirectory(skillDir) || name.startsWith('.')) continue
    const skillMd = `${skillDir}/SKILL.md`
    if (!exists(skillMd)) continue
    const content = readFile(skillMd)
    const stats = getStats(skillMd)
    const { description, model, context } = parseSkillFrontmatter(content)
    entries.push({
      name,
      source,
      sourcePath: skillMd,
      description,
      model,
      context,
      fileSizeBytes: stats.size,
      estimatedTokens: estimate(content),
      loaded: null,
    })
  }
  return entries
}

function scanMarketplaceSkills(marketplacesDir: string, settings: SettingsFile): SkillEntry[] {
  const entries: SkillEntry[] = []
  if (!exists(marketplacesDir) || !isDirectory(marketplacesDir)) return entries

  // Build set of enabled plugin IDs from settings: "marketplace/pluginId"
  const enabledPluginIds = new Set<string>()
  const enabledMarketplaces = new Set<string>()
  for (const [fullId, enabled] of Object.entries(settings.enabledPlugins ?? {})) {
    if (enabled) {
      const [pluginId, marketplace] = fullId.split('@')
      enabledPluginIds.add(`${marketplace}/${pluginId}`)
      enabledMarketplaces.add(marketplace ?? '')
    }
  }

  for (const marketplace of readDir(marketplacesDir)) {
    const mpDir = `${marketplacesDir}/${marketplace}`
    if (!isDirectory(mpDir)) continue

    // Only scan marketplace-level skills/ for enabled marketplaces
    const mpSkillsDir = `${mpDir}/skills`
    if (exists(mpSkillsDir) && enabledMarketplaces.has(marketplace)) {
      const mpSkills = scanSkills(mpSkillsDir, 'plugin-marketplace')
      for (const s of mpSkills) {
        entries.push({ ...s, source: 'plugin-marketplace' })
      }
    }

    const pluginsDir = `${mpDir}/plugins`
    if (!exists(pluginsDir)) continue
    for (const pluginId of readDir(pluginsDir)) {
      // Skip plugins not in enabledPlugins
      if (!enabledPluginIds.has(`${marketplace}/${pluginId}`)) continue
      const skillsDir = `${pluginsDir}/${pluginId}/skills`
      const skills = scanSkills(skillsDir, 'plugin-marketplace')
      for (const s of skills) {
        entries.push({ ...s, source: 'plugin-marketplace' })
      }
    }
  }
  return entries
}

/**
 * Scan commands/ directory as skills (CodeBuddy shows commands alongside skills
 * in /context under "Skills and slash commands"). Each .md file is a command
 * that counts as a "skill" with description tokens only.
 */
function scanCommandsAsSkills(dir: string, source: SkillEntry['source']): SkillEntry[] {
  const entries: SkillEntry[] = []
  if (!exists(dir) || !isDirectory(dir)) return entries
  for (const entry of readDir(dir)) {
    const fullPath = `${dir}/${entry}`
    if (isDirectory(fullPath)) {
      // Recursively scan subdirectories (e.g. opsx/apply.md)
      const nested = scanCommandsAsSkills(fullPath, source)
      entries.push(...nested)
    } else if (entry.endsWith('.md')) {
      const content = readFile(fullPath)
      const stats = getStats(fullPath)
      const { description } = parseSkillFrontmatter(content)
      // /context shows only "description tokens" for commands — use description length
      // not full file size for token estimation
      const descTokens = description ? Math.ceil(description.length / 4) : Math.ceil(content.length / 4)
      const name = entry.replace(/\.md$/, '')
      entries.push({
        name,
        source,
        sourcePath: fullPath,
        description,
        fileSizeBytes: stats.size,
        estimatedTokens: descTokens,
        loaded: null,
      })
    }
  }
  return entries
}

function parseSkillFrontmatter(content: string): {
  description: string
  model?: string
  context?: string
} {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return { description: '' }
  const frontmatter = match[1] ?? ''
  const desc = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim()
  const model = frontmatter.match(/^model:\s*(.+)$/m)?.[1]?.trim()
  const context = frontmatter.match(/^context:\s*(.+)$/m)?.[1]?.trim()
  return {
    description: desc ?? '',
    model,
    context,
  }
}

function summarizeFile(path: string): ConfigFileSummary {
  if (!exists(path)) {
    return {
      path,
      exists: false,
      sizeBytes: 0,
      lineCount: 0,
      estimatedTokens: 0,
      impactLevel: 'low',
    }
  }
  const content = readFile(path)
  const stats = getStats(path)
  const lineCount = content.split('\n').length
  return {
    path,
    exists: true,
    sizeBytes: stats.size,
    lineCount,
    estimatedTokens: estimate(content),
    impactLevel: impactLevel(stats.size),
  }
}
