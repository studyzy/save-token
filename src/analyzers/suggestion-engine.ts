import type {
  DiagnosisReport,
  OptimizationSuggestion,
  ProjectProfile,
  ToolId,
  UsageScenario,
} from '../types'
import type { ToolInstallResult } from '../types'
import {
  TOOL_SAVINGS,
  TOOL_REASONS,
  SCENARIO_TOOL_MAP,
  CODE_KNOWLEDGE_MCPS,
} from '../analyzers/rules'
import { readFile, exists } from '../utils/fs-operations'
import { estimate } from '../collectors/token-estimator'

export function generateSuggestions(
  report: DiagnosisReport,
  scenario: UsageScenario = 'general',
  profile: ProjectProfile = {
    codeFileCount: 0,
    docFileCount: 0,
    isLargeCodebase: false,
    hasLargeDocs: false,
  },
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = []
  const total = report.contextOverview.totalEstimatedTokens || 1
  const recommendedTools = new Set<ToolId>(SCENARIO_TOOL_MAP[scenario])

  // Graphify: recommended only for large codebases (coding/general)
  if (profile.isLargeCodebase && scenario !== 'docs') {
    recommendedTools.add('graphify')
  }

  // Tool installation suggestions — filtered by scenario
  for (const tool of report.toolDetection) {
    if (!tool.installed && recommendedTools.has(tool.name)) {
      suggestions.push({
        id: `install-${tool.name}`,
        type: 'install_tool',
        wasteCategory: 'runtime',
        target: tool.name,
        reason: TOOL_REASONS[tool.name],
        estimatedSavingTokens: TOOL_SAVINGS[tool.name],
        estimatedSavingPercent: (TOOL_SAVINGS[tool.name] / total) * 100,
        risk: 'low',
        reversible: true,
        actionType: getInstallAction(tool.name),
        actionPayload: {
          installCommand: getInstallCommand(tool.name),
          verifyCommand: getVerifyCommand(tool.name),
          configCommand: getConfigCommand(tool.name),
        },
      })
    }
  }

  // Code knowledge-base MCP: recommended for large codebase + large docs
  if (profile.isLargeCodebase && profile.hasLargeDocs && scenario !== 'docs') {
    const mcpNames = CODE_KNOWLEDGE_MCPS.map((m) => m.name).join(' / ')
    const installCmds = CODE_KNOWLEDGE_MCPS.map((m) => m.installCommand).join('; ')
    suggestions.push({
      id: 'install-code-knowledge-mcp',
      type: 'habit_suggestion',
      wasteCategory: 'structural',
      target: mcpNames,
      reason: `大代码量+大量文档项目，建议安装代码知识库 MCP 减少盲搜 Token（${mcpNames}）`,
      estimatedSavingTokens: 5000,
      estimatedSavingPercent: (5000 / total) * 100,
      risk: 'low',
      reversible: true,
      actionType: 'install_rtk', // placeholder — habit suggestion
      actionPayload: {
        installCommand: installCmds,
      },
    })
  }

  // MCP: CLI alternatives
  for (const mcp of report.mcpList) {
    if (mcp.status !== 'enabled') continue
    if (mcp.hasCliAlternative) {
      suggestions.push({
        id: `disable-mcp-${mcp.name}`,
        type: 'config_change',
        wasteCategory: 'structural',
        target: mcp.name,
        reason: `MCP 有 CLI 等价物 ${mcp.cliAlternative}，CLI 不占用持久上下文`,
        estimatedSavingTokens: mcp.estimatedTokens,
        estimatedSavingPercent: (mcp.estimatedTokens / total) * 100,
        risk: 'low',
        reversible: true,
        actionType: 'disable_mcp',
        actionPayload: {
          targetFile: '~/.codebuddy/.mcp.json',
          operation: 'move-to-disabled',
        },
      })
    } else if (!mcp.deferLoading && (mcp.toolsCount ?? 0) > 3) {
      suggestions.push({
        id: `defer-mcp-${mcp.name}`,
        type: 'config_change',
        wasteCategory: 'structural',
        target: mcp.name,
        reason: `${mcp.name} 工具数 ${mcp.toolsCount ?? '?'}，常驻占用，建议延迟加载`,
        estimatedSavingTokens: Math.floor(mcp.estimatedTokens * 0.7),
        estimatedSavingPercent: ((mcp.estimatedTokens * 0.7) / total) * 100,
        risk: 'low',
        reversible: true,
        actionType: 'enable_mcp_defer_loading',
        actionPayload: {
          targetFile: '~/.codebuddy/.mcp.json',
          operation: 'set-field',
          fieldName: 'defer_loading',
          fieldValue: true,
        },
      })
    }
  }

  if (report.mcpList.filter((m) => m.status === 'enabled').length > 5) {
    suggestions.push({
      id: 'mcp-count-warning',
      type: 'habit_suggestion',
      wasteCategory: 'structural',
      target: 'MCP 总数',
      reason: '启用 MCP 超过 5 个，建议禁用低频或用 CLI 替代',
      estimatedSavingTokens: 0,
      estimatedSavingPercent: 0,
      risk: 'low',
      reversible: true,
      actionType: 'disable_mcp',
      actionPayload: {},
    })
  }

  // Skill/Plugin removal suggestions are now handled by LLM (callLlmForRemovalAdvice).
  // Keep only structural warnings that are not scenario-dependent.

  if (report.skillList.length > 10) {
    suggestions.push({
      id: 'skill-count-warning',
      type: 'config_change',
      wasteCategory: 'structural',
      target: 'Skills 总数',
      reason: `已加载 ${report.skillList.length} 个 Skill，建议禁用低频 skill`,
      estimatedSavingTokens: Math.floor(
        report.skillList.slice(10).reduce((s, x) => s + x.estimatedTokens, 0) * 0.5,
      ),
      estimatedSavingPercent:
        ((report.skillList.slice(10).reduce((s, x) => s + x.estimatedTokens, 0) * 0.5) / total) *
        100,
      risk: 'medium',
      reversible: true,
      actionType: 'disable_skill',
      actionPayload: {},
    })
  }

  // Check both global and project CODEBUDDY.md
  const codebuddyMds = report.configFiles.filter((c) => c.path.endsWith('CODEBUDDY.md'))
  for (const codebuddyMd of codebuddyMds) {
    if (codebuddyMd.exists && codebuddyMd.lineCount > 200) {
      const label = codebuddyMd.path.includes(process.cwd()) ? '项目 CODEBUDDY.md' : 'CODEBUDDY.md'
      suggestions.push({
        id: 'simplify-codebuddy-md',
        type: 'habit_suggestion',
        wasteCategory: 'structural',
        target: codebuddyMd.path,
        reason: `${label} ${codebuddyMd.lineCount} 行，建议精简`,
        estimatedSavingTokens: Math.floor(codebuddyMd.estimatedTokens * 0.4),
        estimatedSavingPercent: ((codebuddyMd.estimatedTokens * 0.4) / total) * 100,
        risk: 'medium',
        reversible: true,
        actionType: 'simplify_codebuddy_md',
        actionPayload: {},
      })
    }
  }

  // Cache instability detection — patterns that break Anthropic prefix caching
  for (const codebuddyMd of codebuddyMds) {
    if (codebuddyMd?.path && exists(codebuddyMd.path)) {
      const content = readFile(codebuddyMd.path)
      if (content.length >= 200) {
        suggestions.push(...detectCacheInstability(codebuddyMd.path, content, total))
      }
    }
  }

  if (
    report.configFiles.find((c) => c.path.endsWith('history.jsonl'))?.sizeBytes ??
    0 > 50 * 1024 * 1024
  ) {
    suggestions.push({
      id: 'cleanup-history',
      type: 'habit_suggestion',
      wasteCategory: 'structural',
      target: 'history.jsonl',
      reason: 'history.jsonl 超过 50MB，建议清理',
      estimatedSavingTokens: 0,
      estimatedSavingPercent: 0,
      risk: 'low',
      reversible: false,
      actionType: 'cleanup_history',
      actionPayload: {},
    })
  }

  return suggestions.sort((a, b) => b.estimatedSavingTokens - a.estimatedSavingTokens)
}

function getInstallAction(tool: ToolId): OptimizationSuggestion['actionType'] {
  return `install_${tool}` as OptimizationSuggestion['actionType']
}

function getInstallCommand(tool: ToolId): string {
  switch (tool) {
    case 'rtk':
      return 'brew install rtk && rtk init -g --agent codebuddy'
    case 'caveman':
      return 'git clone https://github.com/studyzy/caveman /tmp/caveman && cd /tmp/caveman && ./install.sh'
    case 'headroom':
      return 'pip install "headroom-ai[all]" && headroom mcp install'
    case 'lean-ctx':
      return 'brew install lean-ctx && lean-ctx setup'
    case 'graphify':
      return 'uv tool install graphifyy && graphify install --platform codebuddy'
    case 'ponytail':
      return 'codebuddy plugin marketplace add https://github.com/studyzy/ponytail'
  }
}

function getVerifyCommand(tool: ToolId): string {
  switch (tool) {
    case 'rtk':
      return 'rtk gain'
    case 'caveman':
      return 'ls ~/.codebuddy/plugins/marketplaces/caveman/'
    case 'headroom':
      return 'headroom --version'
    case 'lean-ctx':
      return 'lean-ctx doctor'
    case 'graphify':
      return 'graphify --version'
    case 'ponytail':
      return 'ls ~/.codebuddy/plugins/marketplaces/ponytail/'
  }
}

function getConfigCommand(tool: ToolId): string {
  switch (tool) {
    case 'rtk':
      return 'rtk init -g --agent codebuddy'
    case 'caveman':
      return ''
    case 'headroom':
      return 'headroom mcp install'
    case 'lean-ctx':
      return 'lean-ctx setup'
    case 'graphify':
      return 'graphify install --platform codebuddy'
    case 'ponytail':
      return ''
  }
}

// ── Cache instability detection ──────────────────────────────────────────

const TIMESTAMP_PATTERNS = [
  /\d{4}-\d{2}-\d{2}/,
  /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\w+\s+\d{1,2}/,
  /^(Updated|Last\s+(updated|modified|synced)):/im,
  /^As\s+\d{4}-\d{2}/im,
] as const

const DYNAMIC_SECTION_MARKERS = [
  /TOKEN_OPTIMIZER:MODEL_ROUTING/,
  /AUTO-GENERATED/,
  /DO NOT EDIT/,
  /Generated by/,
  /Synced from/,
] as const

const VOLATILE_IMPORT_KEYWORDS = ['status', 'log', 'daily', 'current', 'temp', 'cache']

function detectCacheInstability(
  path: string,
  content: string,
  total: number,
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = []
  const lines = content.split('\n')
  const cutoff = Math.max(1, Math.floor(lines.length * 0.6))
  const prefix = lines.slice(0, cutoff).join('\n')

  for (const pattern of TIMESTAMP_PATTERNS) {
    const m = pattern.exec(prefix)
    if (m) {
      const hitLine = prefix.substring(0, m.index).split('\n').length
      const wasted = estimate(lines.slice(hitLine).join('\n'))
      if (wasted > 500) {
        suggestions.push({
          id: 'cache-instability-timestamp',
          type: 'config_change',
          wasteCategory: 'structural',
          target: path,
          reason: `CODEBUDDY.md 前缀含时间戳 "${m[0]}"，每次变化都会破坏 prompt 缓存。建议移到文件末尾或去掉。`,
          estimatedSavingTokens: wasted,
          estimatedSavingPercent: (wasted / total) * 100,
          risk: 'low',
          reversible: true,
          actionType: 'simplify_codebuddy_md',
          actionPayload: {},
        })
      }
      break
    }
  }

  for (const pattern of DYNAMIC_SECTION_MARKERS) {
    const m = pattern.exec(prefix)
    if (m) {
      const hitLine = prefix.substring(0, m.index).split('\n').length
      const wasted = estimate(lines.slice(hitLine).join('\n'))
      if (wasted > 500) {
        suggestions.push({
          id: 'cache-instability-autogen',
          type: 'config_change',
          wasteCategory: 'structural',
          target: path,
          reason: `CODEBUDDY.md 前缀含自动生成标记 "${m[0]}"，动态内容破坏缓存。建议移到文件末尾。`,
          estimatedSavingTokens: wasted,
          estimatedSavingPercent: (wasted / total) * 100,
          risk: 'low',
          reversible: true,
          actionType: 'simplify_codebuddy_md',
          actionPayload: {},
        })
      }
      break
    }
  }

  const importPattern = /@import\s+"([^"]+)"/g
  let importMatch: RegExpExecArray | null
  while ((importMatch = importPattern.exec(prefix)) !== null) {
    const importPath = importMatch[1]
    if (VOLATILE_IMPORT_KEYWORDS.some((kw) => importPath.toLowerCase().includes(kw))) {
      suggestions.push({
        id: 'cache-instability-import',
        type: 'config_change',
        wasteCategory: 'structural',
        target: path,
        reason: `CODEBUDDY.md @import "${importPath}" 指向易变文件，破坏缓存稳定性`,
        estimatedSavingTokens: 2000,
        estimatedSavingPercent: (2000 / total) * 100,
        risk: 'low',
        reversible: true,
        actionType: 'simplify_codebuddy_md',
        actionPayload: {},
      })
      break
    }
  }

  return suggestions
}

export type { ToolInstallResult }
