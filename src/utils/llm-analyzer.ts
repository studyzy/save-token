import { exec } from 'tinyexec'
import type {
  DiagnosisReport,
  OptimizationSuggestion,
  ProjectProfile,
  UsageScenario,
} from '../types'
import type { SuggestionType, RiskLevel, ActionType, WasteCategory } from '../types'
import { createLogger } from './debug-logger'

const log = createLogger('llm-analyzer')
const TIMEOUT_MS = 60_000

interface LlmRemovalItem {
  target: string
  type: 'skill' | 'mcp' | 'agent' | 'plugin' | 'hook'
  reason: string
  estimatedSavingTokens: number
}

function buildDiagnosisSummary(report: DiagnosisReport) {
  return {
    skills: report.skillList.map((s) => ({
      name: s.name,
      source: s.source,
      description: s.description,
      estimatedTokens: s.estimatedTokens,
    })),
    mcps: report.mcpList
      .filter((m) => m.status === 'enabled')
      .map((m) => ({
        name: m.name,
        type: m.type,
        toolsCount: m.toolsCount,
        estimatedTokens: m.estimatedTokens,
      })),
    plugins: report.pluginList
      .filter((p) => p.enabled)
      .map((p) => ({ id: p.id, marketplace: p.marketplace })),
    agents: report.hookList.map((h) => ({
      event: h.event,
      matcher: h.matcher,
      command: h.command,
    })),
    hooks: report.hookList.map((h) => ({ event: h.event, matcher: h.matcher, command: h.command })),
  }
}

function scenarioLabel(s: UsageScenario): string {
  switch (s) {
    case 'coding':
      return '代码开发'
    case 'docs':
      return '文档写作'
    default:
      return '通用'
  }
}

function buildPrompt(
  report: DiagnosisReport,
  scenario: UsageScenario,
  profile: ProjectProfile,
): string {
  const summary = buildDiagnosisSummary(report)
  const contextJson = JSON.stringify(
    {
      scenario,
      projectProfile: profile,
      diagnosis: summary,
    },
    null,
    2,
  )

  return `你是一个 CodeBuddy 配置优化专家。用户正在使用 CodeBuddy 进行【${scenarioLabel(scenario)}】工作。
当前项目有 ${profile.codeFileCount} 个代码文件、${profile.docFileCount} 个文档文件。
${profile.isLargeCodebase ? '这是一个大代码量项目。' : ''}${profile.hasLargeDocs ? '该项目有大量文档。' : ''}

以下是诊断工具扫描到的当前配置中的 Skill、MCP、Plugin、Hook 列表：

\`\`\`json
${contextJson}
\`\`\`

请分析哪些条目对【${scenarioLabel(scenario)}】场景是不必要的，建议移除/禁用。
对每个建议，说明原因和预估节省的 Token。

只输出一个 JSON 数组，不要任何其他文字。格式如下：
[{"target": "条目名称", "type": "skill|mcp|agent|plugin|hook", "reason": "移除原因", "estimatedSavingTokens": 数字}]

如果没有需要移除的条目，输出空数组 []。`
}

/**
 * Call codebuddy -p to get LLM-driven removal suggestions for
 * Skills, MCPs, Plugins, and Hooks that are irrelevant to the user's scenario.
 * On failure, returns empty array (caller should fall back to hardcoded rules).
 */
export async function callLlmForRemovalAdvice(
  report: DiagnosisReport,
  scenario: UsageScenario,
  profile: ProjectProfile,
): Promise<OptimizationSuggestion[]> {
  const prompt = buildPrompt(report, scenario, profile)
  log(
    'Calling codebuddy -p for removal analysis, prompt length=%d chars\n%s',
    prompt.length,
    prompt,
  )

  try {
    const result = await exec(
      'codebuddy',
      ['-p', prompt, '--output-format', 'json', '-y', '--max-turns', '2'],
      { timeout: TIMEOUT_MS },
    )

    log(
      'codebuddy exited with code=%d, stdout length=%d, stderr length=%d',
      result.exitCode,
      result.stdout?.length ?? 0,
      result.stderr?.length ?? 0,
    )

    if (result.exitCode !== 0 || !result.stdout) {
      log('LLM analysis failed: exitCode=%d, stderr=%s', result.exitCode, result.stderr ?? '(none)')
      return []
    }

    log('LLM raw stdout:\n%s', result.stdout)

    // --output-format json returns a JSON array of stream events.
    // The last item (type=result) contains the actual response in .result.
    let raw: unknown
    try {
      const parsed: unknown = JSON.parse(result.stdout)
      log(
        'LLM response JSON parsed successfully, top-level type=%s',
        typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
          ? 'object'
          : 'array',
      )
      if (Array.isArray(parsed) && parsed.length > 0) {
        const arr: unknown[] = parsed
        const last: unknown = arr[arr.length - 1]
        raw =
          last && typeof last === 'object' && 'result' in last
            ? (last as Record<string, unknown>).result
            : parsed
      } else if (typeof parsed === 'object' && parsed !== null) {
        const obj = parsed as Record<string, unknown>
        raw = obj.structured_output ?? obj.result ?? parsed
      } else {
        raw = parsed
      }
    } catch (e) {
      log('Failed to parse LLM response JSON: %s', (e as Error).message)
      return []
    }

    const items: LlmRemovalItem[] = Array.isArray(raw) ? (raw as LlmRemovalItem[]) : []
    // LLM may wrap JSON in markdown code blocks. Try to extract.
    if (items.length === 0 && typeof raw === 'string') {
      const match = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (match) {
        try {
          const extracted: unknown = JSON.parse(match[1].trim())
          if (Array.isArray(extracted)) {
            items.push(...(extracted as LlmRemovalItem[]))
          }
        } catch {
          /* ignore */
        }
      }
    }
    if (items.length === 0) return []
    const total = report.contextOverview.totalEstimatedTokens || 1

    return items.map((item) => ({
      id: `llm-remove-${item.type}-${item.target.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
      type: suggestionType(item.type),
      wasteCategory: wasteCategory(item.type),
      target: item.target,
      reason: `[AI 分析] ${item.reason}`,
      estimatedSavingTokens: item.estimatedSavingTokens,
      estimatedSavingPercent: (item.estimatedSavingTokens / total) * 100,
      risk: riskLevel(item.type),
      reversible: true,
      actionType: actionType(item.type),
      actionPayload: {},
    }))
  } catch (e) {
    log('LLM analysis call exception: %s', (e as Error).message)
    return []
  }
}

function suggestionType(t: LlmRemovalItem['type']): SuggestionType {
  if (t === 'skill' || t === 'plugin') return 'config_change'
  if (t === 'mcp') return 'config_change'
  return 'habit_suggestion'
}

function wasteCategory(_t: LlmRemovalItem['type']): WasteCategory {
  return 'structural'
}

function riskLevel(_t: LlmRemovalItem['type']): RiskLevel {
  return 'low'
}

function actionType(t: LlmRemovalItem['type']): ActionType {
  switch (t) {
    case 'mcp':
      return 'disable_mcp'
    case 'plugin':
      return 'disable_plugin'
    case 'skill':
      return 'disable_skill'
    default:
      return 'disable_skill'
  }
}

/**
 * Fallback hardcoded removal rules when LLM is unavailable.
 */
export function fallbackRemovalSuggestions(
  report: DiagnosisReport,
  scenario: UsageScenario,
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = []
  const total = report.contextOverview.totalEstimatedTokens || 1

  if (scenario === 'coding') {
    const docPlugins = ['pptx', 'docx', 'xlsx']
    for (const plugin of report.pluginList) {
      if (!plugin.enabled) continue
      const isDoc = docPlugins.some((d) => plugin.id.toLowerCase().includes(d))
      if (isDoc) {
        suggestions.push({
          id: `fallback-remove-plugin-${plugin.id}`,
          type: 'config_change',
          wasteCategory: 'structural',
          target: plugin.id,
          reason: '代码开发场景不需要文档类 Plugin',
          estimatedSavingTokens: 500,
          estimatedSavingPercent: (500 / total) * 100,
          risk: 'low',
          reversible: true,
          actionType: 'disable_plugin',
          actionPayload: {},
        })
      }
    }
    const docSkills = ['pptx', 'docx', 'xlsx', 'presentation']
    for (const skill of report.skillList) {
      const isDoc = docSkills.some((d) => skill.name.toLowerCase().includes(d))
      if (isDoc) {
        suggestions.push({
          id: `fallback-remove-skill-${skill.name}`,
          type: 'config_change',
          wasteCategory: 'structural',
          target: skill.name,
          reason: '代码开发场景不需要文档类 Skill',
          estimatedSavingTokens: skill.estimatedTokens,
          estimatedSavingPercent: (skill.estimatedTokens / total) * 100,
          risk: 'low',
          reversible: true,
          actionType: 'disable_skill',
          actionPayload: {},
        })
      }
    }
  }

  if (scenario === 'docs') {
    const codePlugins = ['caveman', 'ponytail']
    for (const plugin of report.pluginList) {
      if (!plugin.enabled) continue
      const isCode = codePlugins.some((c) => plugin.id.toLowerCase().includes(c))
      if (isCode) {
        suggestions.push({
          id: `fallback-remove-plugin-${plugin.id}`,
          type: 'config_change',
          wasteCategory: 'structural',
          target: plugin.id,
          reason: '文档写作场景不需要代码类 Plugin',
          estimatedSavingTokens: 500,
          estimatedSavingPercent: (500 / total) * 100,
          risk: 'low',
          reversible: true,
          actionType: 'disable_plugin',
          actionPayload: {},
        })
      }
    }
  }

  return suggestions
}
