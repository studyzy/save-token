import type { DiagnoseOptions, DiagnosisReport, ContextItem, ToolDetection, SkillEntry } from '../types'
import type { ToolId } from '../types'
import { CodeBuddyAdapter } from '../adapters/codebuddy-adapter'
import { scanFilesystem } from '../collectors/fs-collector'
import { probe } from '../collectors/headless-collector'
import { MCP_LIST_PROMPT, MCP_LIST_SCHEMA, SKILL_LIST_PROMPT, SKILL_LIST_SCHEMA } from '../utils/prompt-templates'
import { commandExists, getPlatform } from '../utils/platform'
import { exec } from 'tinyexec'
import { printDiagnosisReport } from '../utils/output'
import { writeFile } from '../utils/fs-operations'
import { handleExitPromptError, handleGeneralError } from '../utils/error-handler'
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
    const report = await runDiagnose(adapter, options)
    printDiagnosisReport(report, options.format ?? 'terminal')
    if (options.report) {
      writeFile(options.report, JSON.stringify(report, null, 2))
    }
  } catch (error) {
    if (!handleExitPromptError(error)) handleGeneralError(error)
  }
}

export async function runDiagnose(
  adapter: CodeBuddyAdapter,
  options: DiagnoseOptions,
): Promise<DiagnosisReport> {
  const warnings: string[] = []
  const platform = getPlatform()

  const codebuddyInstalled = await adapter.detectInstall()
  let codebuddyVersion: string | null = null
  let headlessAvailable = false

  if (!codebuddyInstalled) {
    warnings.push(i18n.t('errors:codebuddyNotFound'))
  } else {
    codebuddyVersion = await getCodebuddyVersion()
    if (!options.noHeadless) {
      headlessAvailable = true
    }
  }

  const fs = scanFilesystem(adapter)

  let mcpList = fs.mcpList
  let skillList = fs.skillList

  if (headlessAvailable && !options.noHeadless) {
    const [mcpProbe, skillProbe] = await Promise.all([
      probe(adapter, MCP_LIST_PROMPT, MCP_LIST_SCHEMA),
      probe(adapter, SKILL_LIST_PROMPT, SKILL_LIST_SCHEMA),
    ])
    if (!mcpProbe.ok) {
      warnings.push(i18n.t('errors:headlessFailed'))
      headlessAvailable = false
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

  return {
    scanTimestamp: new Date().toISOString(),
    codebuddyVersion,
    platform,
    contextOverview,
    mcpList,
    skillList,
    pluginList: fs.pluginList,
    hookList: fs.hookList,
    configFiles: fs.configFiles,
    toolDetection,
    headlessAvailable,
    warnings,
  }
}

async function getCodebuddyVersion(): Promise<string | null> {
  try {
    const res = await exec('codebuddy', ['--version'])
    if (res.exitCode === 0 && res.stdout) {
      return res.stdout.trim().split('\n')[0]!.trim()
    }
  } catch {
    // ignore
  }
  return null
}

function mergeMcpLists(fsList: DiagnosisReport['mcpList'], headless: HeadlessMcpItem[]): DiagnosisReport['mcpList'] {
  const headlessMap = new Map(headless.map(h => [h.name, h]))
  return fsList.map(mcp => {
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

function mergeSkillLists(fsList: DiagnosisReport['skillList'], headless: HeadlessSkillItem[]): DiagnosisReport['skillList'] {
  // Headless probe reflects actual loaded skills — use it as authoritative source
  // but enrich with filesystem metadata (sourcePath, fileSizeBytes, estimatedTokens)
  if (headless.length > 0) {
    const fsByName = new Map(fsList.map(s => [s.name, s]))
    return headless.map(h => {
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
  return fsList.map(s => ({ ...s, loaded: false }))
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
    const isMemory = cfg.path.endsWith('CODEBUDDY.md')
    items.push({
      name: cfg.path.split('/').pop() ?? cfg.path,
      type: isMemory ? 'memory-file' : 'system-prompt',
      estimatedTokens: cfg.estimatedTokens,
      source: cfg.path,
    })
  }
  const total = items.reduce((sum, i) => sum + i.estimatedTokens, 0)
  return { totalEstimatedTokens: total, breakdown: items }
}

async function detectTools(fs: ReturnType<typeof scanFilesystem>): Promise<ToolDetection[]> {
  const tools: Array<{ id: ToolId; saving: string; type: 'cli' | 'plugin' }> = [
    { id: 'rtk', saving: '~89% 命令输出压缩', type: 'cli' },
    { id: 'caveman', saving: '65-75% AI 回复压缩', type: 'plugin' },
    { id: 'headroom', saving: '47-92% 上下文压缩', type: 'cli' },
    { id: 'lean-ctx', saving: '60-90% 读取筛选', type: 'cli' },
    { id: 'graphify', saving: '71.5x 代码图谱', type: 'cli' },
  ]
  const results: ToolDetection[] = []
  for (const t of tools) {
    let installed = false
    let codebuddyIntegrated = false

    if (t.type === 'plugin') {
      // Check if plugin exists in enabledPlugins or its marketplace directory
      const plugin = fs.pluginList.find(p => p.pluginId === t.id)
      installed = !!plugin?.enabled
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
