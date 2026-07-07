import type {
  DiagnoseOptions,
  DiagnosisReport,
  ContextItem,
  ToolDetection,
  SkillEntry,
  McpEntry,
  ProxyToolDef,
  ProxyDiagnosisData,
} from '../types'
import type { ToolId } from '../types'
import { CodeBuddyAdapter } from '../adapters/codebuddy-adapter'
import { scanFilesystem } from '../collectors/fs-collector'
import { probe } from '../collectors/headless-collector'
import { runProxyDiagnose } from '../collectors/proxy-collector'
import {
  MCP_LIST_PROMPT,
  MCP_LIST_SCHEMA,
  SKILL_LIST_PROMPT,
  SKILL_LIST_SCHEMA,
} from '../utils/prompt-templates'
import { commandExists, getPlatform } from '../utils/platform'
import { exec } from 'tinyexec'
import { printDiagnosisReport } from '../utils/output'
import { writeFile } from '../utils/fs-operations'
import { handleExitPromptError, handleGeneralError } from '../utils/error-handler'
import { writeResource } from '../utils/resource-dir'
import { i18n } from '../i18n'

interface HeadlessMcpItem {
  name: string
  status: string
  toolsCount: number | null
  source: string
}

interface HeadlessSkillItem {
  name: string
  source: string
  description: string
}

export async function diagnose(options: DiagnoseOptions): Promise<void> {
  try {
    const adapter = new CodeBuddyAdapter()
    const { report, rawBody } = await runDiagnose(adapter, options)
    printDiagnosisReport(report, options.format ?? 'terminal')
    if (options.report) {
      writeFile(options.report, JSON.stringify(report, null, 2))
      // Write raw proxy body if available
      if (rawBody) {
        const rawPath = options.report.replace(/\.json$/, '-raw.json')
        writeFile(rawPath, JSON.stringify(rawBody, null, 2))
      }
    }
  } catch (error) {
    if (!handleExitPromptError(error)) handleGeneralError(error)
  }
}

export interface DiagnoseResult {
  report: DiagnosisReport
  rawBody: unknown
}

export async function runDiagnose(
  adapter: CodeBuddyAdapter,
  options: DiagnoseOptions,
): Promise<DiagnoseResult> {
  const warnings: string[] = []
  const platform = getPlatform()

  const codebuddyInstalled = await adapter.detectInstall()
  let codebuddyVersion: string | null = null
  let headlessAvailable = false
  let rawBody: unknown = null
  let dataSource: DiagnosisReport['dataSource'] = 'fs-only'

  if (!codebuddyInstalled) {
    warnings.push(i18n.t('errors:codebuddyNotFound'))
  } else {
    codebuddyVersion = await getCodebuddyVersion()
    if (!options.noHeadless) {
      headlessAvailable = true
    }
  }

  const fs = scanFilesystem(adapter)
  writeResource('fs-collect.json', fs)

  let mcpList = fs.mcpList
  let skillList = fs.skillList

  // Priority 1: Proxy mode — intercept real API request
  if (headlessAvailable && !options.noHeadless) {
    const proxyResult = await runProxyDiagnose(adapter)
    if (proxyResult.ok && proxyResult.parsed) {
      dataSource = 'proxy'
      rawBody = proxyResult.rawBody
      writeResource('proxy-raw-body.json', proxyResult.rawBody)
      writeResource('proxy-parsed.json', proxyResult.parsed)

      // Build context overview from proxy data
      const proxyContextItems: ContextItem[] = []

      // Messages by role
      for (const [role, info] of Object.entries(proxyResult.parsed.messagesByRole)) {
        proxyContextItems.push({
          name: `${role} messages`,
          type: 'message',
          estimatedTokens: info.estimatedTokens,
          source: 'proxy',
        })
      }

      // Tool definitions — show as top-level item
      if (proxyResult.parsed.toolDefinitionsTokens > 0) {
        const builtin = proxyResult.parsed.builtinToolCount
        const mcp = proxyResult.parsed.mcpToolCount
        proxyContextItems.push({
          name: `Tool definitions (${builtin}内置 + ${mcp}MCP工具)`,
          type: 'tool-definitions',
          estimatedTokens: proxyResult.parsed.toolDefinitionsTokens,
          source: 'proxy',
        })
      }

      const contextOverview: DiagnosisReport['contextOverview'] = {
        totalEstimatedTokens: proxyResult.parsed.totalEstimatedTokens,
        breakdown: proxyContextItems,
      }

      // In proxy mode, only show skills that actually appear in the POST body.
      // Skills present on disk but not in the Skill tool definition are not loaded
      // and consume zero tokens — they should not be listed.
      const skillTokens = proxyResult.parsed.skillTokens
      const enrichedSkills: SkillEntry[] = []
      for (const [name, tokenInfo] of Object.entries(skillTokens)) {
        const fsSkill = fs.skillList.find((s) => s.name === name)
        enrichedSkills.push({
          name,
          source: fsSkill?.source ?? 'user',
          sourcePath: fsSkill?.sourcePath ?? '',
          description: tokenInfo.description,
          fileSizeBytes: fsSkill?.fileSizeBytes ?? 0,
          estimatedTokens: tokenInfo.estimatedTokens,
          loaded: true,
        })
      }

      const toolDetection = await detectTools(fs, proxyResult.parsed)

      // Ponytail detection from proxy body markers
      if (proxyResult.parsed.detectedPlugins.includes('ponytail')) {
        const idx = toolDetection.findIndex((t) => t.name === 'ponytail')
        if (idx !== -1 && !toolDetection[idx].installed) {
          toolDetection[idx] = {
            ...toolDetection[idx],
            installed: true,
            codebuddyIntegrated: true,
          }
        }
      }

      // Build mcpList from proxy: MCP tools from toolDefinitions + deferred references
      const proxyMcpList: McpEntry[] = buildMcpListFromProxy(
        proxyResult.parsed.toolDefinitions,
        proxyResult.parsed.mcpReferences,
      )

      const report: DiagnosisReport = {
        scanTimestamp: new Date().toISOString(),
        codebuddyVersion,
        platform,
        contextOverview,
        mcpList: proxyMcpList,
        skillList: enrichedSkills,
        pluginList: fs.pluginList,
        hookList: fs.hookList,
        ruleList: fs.ruleList,
        configFiles: fs.configFiles,
        toolDetection,
        headlessAvailable,
        dataSource,
        warnings,
        proxyDetails: {
          model: proxyResult.parsed.model,
          toolDefinitions: proxyResult.parsed.toolDefinitions,
          messageBreakdown: proxyResult.parsed.messageBreakdown,
          skillReferences: proxyResult.parsed.skillReferences,
          mcpReferences: proxyResult.parsed.mcpReferences,
        },
      }
      writeResource('diagnosis-report.json', report)

      return { report, rawBody }
    }
    // Proxy failed, fall through to headless
  }

  // Priority 2: Headless mode — probe via codebuddy -p
  if (headlessAvailable && !options.noHeadless) {
    dataSource = 'headless'
    const [mcpProbe, skillProbe] = await Promise.all([
      probe(adapter, MCP_LIST_PROMPT, MCP_LIST_SCHEMA),
      probe(adapter, SKILL_LIST_PROMPT, SKILL_LIST_SCHEMA),
    ])
    writeResource('headless-mcp.json', mcpProbe)
    writeResource('headless-skill.json', skillProbe)
    if (!mcpProbe.ok) {
      warnings.push(i18n.t('errors:headlessFailed'))
      headlessAvailable = false
      dataSource = 'fs-only'
    } else {
      const headlessMcps = (mcpProbe.parsed as HeadlessMcpItem[]) ?? []
      mcpList = mergeMcpLists(mcpList, headlessMcps)
      const headlessSkills = (skillProbe.parsed as HeadlessSkillItem[]) ?? []
      skillList = mergeSkillLists(skillList, headlessSkills)
    }
  } else if (options.noHeadless) {
    headlessAvailable = false
  }

  const contextOverview = buildContextOverview(fs, mcpList, skillList)
  const toolDetection = await detectTools(fs)

  const report: DiagnosisReport = {
    scanTimestamp: new Date().toISOString(),
    codebuddyVersion,
    platform,
    contextOverview,
    mcpList,
    skillList,
    pluginList: fs.pluginList,
    hookList: fs.hookList,
    ruleList: fs.ruleList,
    configFiles: fs.configFiles,
    toolDetection,
    headlessAvailable,
    dataSource,
    warnings,
  }
  writeResource('diagnosis-report.json', report)

  return { report, rawBody }
}

async function getCodebuddyVersion(): Promise<string | null> {
  try {
    const res = await exec('codebuddy', ['--version'])
    if (res.exitCode === 0 && res.stdout) {
      return res.stdout.trim().split('\n')[0].trim()
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Build McpEntry list from proxy data.
 *
 * Two sources:
 * 1. toolDefinitions (category='mcp') → non-deferred MCP tools with full schema
 * 2. mcpReferences → deferred MCP server references (bare names from ToolSearch description)
 *
 * Groups by server prefix (e.g. mcp__headroom__headroom_compress → server: headroom).
 */
function buildMcpListFromProxy(
  toolDefinitions: ProxyToolDef[],
  mcpReferences: string[],
): McpEntry[] {
  const mcpTools = toolDefinitions.filter((t) => t.category === 'mcp')
  if (mcpTools.length === 0 && mcpReferences.length === 0) return []

  // Group by server: extract server name from mcp__SERVER or mcp__SERVER__toolName
  const serverMap = new Map<
    string,
    {
      toolCount: number
      totalTokens: number
      deferLoading: boolean
      toolEntries: { name: string; estimatedTokens: number }[]
    }
  >()

  // Non-deferred MCP tools (full schema in tools[])
  for (const t of mcpTools) {
    const parts = t.name.split('__')
    const server = parts.length >= 2 ? parts[1] : t.name
    const toolName = parts.length >= 3 ? parts.slice(2).join('__') : t.name
    let entry = serverMap.get(server)
    if (!entry) {
      entry = { toolCount: 0, totalTokens: 0, deferLoading: false, toolEntries: [] }
      serverMap.set(server, entry)
    }
    entry.toolCount++
    entry.totalTokens += t.estimatedTokens
    entry.toolEntries.push({ name: toolName, estimatedTokens: t.estimatedTokens })
  }

  // Deferred MCP references (bare names from ToolSearch description)
  for (const ref of mcpReferences) {
    const parts = ref.split('__')
    // Server-level ref (mcp__SERVER) → just a reference, no concrete tools
    if (parts.length === 2) {
      const server = parts[1]
      let entry = serverMap.get(server)
      if (!entry) {
        entry = { toolCount: 0, totalTokens: 0, deferLoading: true, toolEntries: [] }
        serverMap.set(server, entry)
      }
      entry.totalTokens += Math.ceil(ref.length / 4)
      if (mcpTools.length > 0) entry.deferLoading = false
    }
    // Tool-level deferred ref (mcp__SERVER__toolName) → concrete tool in deferred mode
    if (parts.length >= 3) {
      const server = parts[1]
      const toolName = parts.slice(2).join('__')
      let entry = serverMap.get(server)
      if (!entry) {
        entry = { toolCount: 0, totalTokens: 0, deferLoading: true, toolEntries: [] }
        serverMap.set(server, entry)
      }
      entry.toolCount++
      const tok = Math.ceil(ref.length / 4)
      entry.totalTokens += tok
      entry.toolEntries.push({ name: toolName, estimatedTokens: tok })
    }
  }

  const result: McpEntry[] = []
  for (const [server, entry] of serverMap) {
    result.push({
      name: server,
      type: 'stdio',
      status: 'enabled',
      toolsCount: entry.toolCount > 0 ? entry.toolCount : null,
      toolEntries: entry.toolEntries.length > 0 ? entry.toolEntries : undefined,
      estimatedTokens: entry.totalTokens,
      deferLoading: entry.deferLoading,
      source: 'user',
      hasCliAlternative: false,
    })
  }

  return result
}

function mergeMcpLists(
  fsList: DiagnosisReport['mcpList'],
  headless: HeadlessMcpItem[],
): DiagnosisReport['mcpList'] {
  const headlessMap = new Map(headless.map((h) => [h.name, h]))
  return fsList.map((mcp) => {
    const h = headlessMap.get(mcp.name)
    if (h) {
      return {
        ...mcp,
        toolsCount: h.toolsCount ?? mcp.toolsCount,
        status: h.status === 'enabled' ? 'enabled' : 'disabled',
      }
    }
    return mcp
  })
}

function mergeSkillLists(
  fsList: DiagnosisReport['skillList'],
  headless: HeadlessSkillItem[],
): DiagnosisReport['skillList'] {
  // Headless probe reflects actual loaded skills — use it as authoritative source
  // but enrich with filesystem metadata (sourcePath, fileSizeBytes, estimatedTokens)
  if (headless.length > 0) {
    const fsByName = new Map(fsList.map((s) => [s.name, s]))
    return headless.map((h) => {
      const fsSkill = fsByName.get(h.name)
      return {
        name: h.name,
        source: (h.source as SkillEntry['source']) ?? 'user',
        sourcePath: fsSkill?.sourcePath ?? '',
        description: h.description ?? fsSkill?.description ?? '',
        fileSizeBytes: fsSkill?.fileSizeBytes ?? 0,
        estimatedTokens: fsSkill?.estimatedTokens ?? 0,
        loaded: true,
      }
    })
  }
  return fsList.map((s) => ({ ...s, loaded: false }))
}

function buildContextOverview(
  fs: ReturnType<typeof scanFilesystem>,
  mcpList: DiagnosisReport['mcpList'],
  skillList: DiagnosisReport['skillList'],
): DiagnosisReport['contextOverview'] {
  const items: ContextItem[] = []
  for (const mcp of mcpList) {
    if (mcp.status === 'enabled') {
      items.push({
        name: `MCP: ${mcp.name}`,
        type: 'mcp-tools',
        estimatedTokens: mcp.estimatedTokens,
        source: mcp.name,
      })
    }
  }
  for (const skill of skillList) {
    items.push({
      name: `Skill: ${skill.name}`,
      type: 'skill',
      estimatedTokens: skill.estimatedTokens,
      source: skill.sourcePath,
    })
  }
  for (const cfg of fs.configFiles) {
    if (!cfg.exists) continue
    items.push({
      name: cfg.path.split('/').pop() ?? cfg.path,
      type: 'memory-file',
      estimatedTokens: cfg.estimatedTokens,
      source: cfg.path,
    })
  }
  const total = items.reduce((sum, i) => sum + i.estimatedTokens, 0)
  return { totalEstimatedTokens: total, breakdown: items }
}

async function detectTools(
  fs: ReturnType<typeof scanFilesystem>,
  proxyParsed?: ProxyDiagnosisData,
): Promise<ToolDetection[]> {
  const tools: Array<{ id: ToolId; saving: string; type: 'cli' | 'plugin' }> = [
    { id: 'rtk', saving: '~89% 命令输出压缩', type: 'cli' },
    { id: 'caveman', saving: '65-75% AI 回复压缩', type: 'plugin' },
    { id: 'headroom', saving: '47-92% 上下文压缩', type: 'cli' },
    { id: 'lean-ctx', saving: '60-90% 读取筛选', type: 'cli' },
    { id: 'graphify', saving: '71.5x 代码图谱', type: 'cli' },
    { id: 'ponytail', saving: '54% 代码量 + 20-75% 成本', type: 'plugin' },
  ]
  const results: ToolDetection[] = []
  for (const t of tools) {
    let installed = false
    let codebuddyIntegrated = false

    if (t.type === 'plugin') {
      // Check plugin: marketplace directory exists OR enabledPlugins entry OR proxy-detected
      const plugin = fs.pluginList.find((p) => p.pluginId === t.id)
      const hasMarketplaceDir = await checkPluginMarketplaceDir(t.id)
      const hasEnabledEntry = !!plugin?.enabled
      installed = hasMarketplaceDir || hasEnabledEntry
      // Proxy detection: scan all message content for mode-active markers
      if (!installed && proxyParsed) {
        installed = proxyDetectPlugin(t.id, proxyParsed)
      }
      codebuddyIntegrated = installed
    } else {
      // Check CLI binary on PATH
      installed = await commandExists(t.id)
      codebuddyIntegrated = installed
    }

    results.push({
      name: t.id,
      installed,
      version: null,
      installPath: null,
      codebuddyIntegrated,
      recommendedSaving: t.saving,
    })
  }
  return results
}

/** Check if plugin marketplace directory exists under ~/.codebuddy/plugins/marketplaces/ */
async function checkPluginMarketplaceDir(pluginId: string): Promise<boolean> {
  const { exists: fileExists } = await import('../utils/fs-operations')
  return fileExists(`${process.env.HOME}/.codebuddy/plugins/marketplaces/${pluginId}/`)
}

/**
 * Detect plugin activation from proxy-captured request body.
 * Scans all message content for mode-active markers (e.g. "PONYTAIL MODE ACTIVE").
 */
function proxyDetectPlugin(pluginId: string, parsed: ProxyDiagnosisData): boolean {
  const markers: Record<string, string> = {
    ponytail: 'PONYTAIL MODE ACTIVE',
  }
  const marker = markers[pluginId]
  if (!marker) return false
  for (const block of parsed.messageBreakdown) {
    if (block.snippet.includes(marker)) return true
  }
  return false
}
