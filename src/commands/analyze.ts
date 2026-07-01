import type { AnalyzeOptions } from '../types'
import type { DiagnosisReport, OptimizationSuggestion } from '../types'
import { CodeBuddyAdapter } from '../adapters/codebuddy-adapter'
import { runDiagnose } from './diagnose'
import { generateSuggestions } from '../analyzers/suggestion-engine'
import { printSuggestions } from '../utils/output'
import { writeFile } from '../utils/fs-operations'
import { handleExitPromptError, handleGeneralError } from '../utils/error-handler'

export async function analyze(options: AnalyzeOptions): Promise<void> {
  try {
    const adapter = new CodeBuddyAdapter()
    const report = await runDiagnose(adapter, options)
    const suggestions = generateSuggestions(report)
    const totalSaving = suggestions.reduce((s, x) => s + x.estimatedSavingTokens, 0)
    const totalPercent = report.contextOverview.totalEstimatedTokens
      ? (totalSaving / report.contextOverview.totalEstimatedTokens) * 100
      : 0
    printSuggestions(suggestions, totalSaving, totalPercent, options.format ?? 'terminal')
    if (options.report) {
      const content =
        options.format === 'json'
          ? JSON.stringify({ report, suggestions, totalSaving, totalPercent }, null, 2)
          : renderAnalyzeMd(report, suggestions, totalSaving, totalPercent)
      writeFile(options.report, content)
    }
  } catch (error) {
    if (!handleExitPromptError(error)) handleGeneralError(error)
  }
}

function renderAnalyzeMd(
  _report: DiagnosisReport,
  suggestions: OptimizationSuggestion[],
  totalSaving: number,
  totalPercent: number,
): string {
  const lines: string[] = []
  lines.push('# 优化建议报告')
  lines.push('')
  lines.push(`预估总节省: **${totalSaving} Token (${totalPercent.toFixed(1)}%)**`)
  lines.push('')
  lines.push('| # | 目标 | 类型 | 节省 | 风险 | 可逆 | 原因 |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  suggestions.forEach((s, i) => {
    lines.push(
      `| ${i + 1} | ${s.target} | ${s.type} | ${s.estimatedSavingTokens} | ${s.risk} | ${s.reversible} | ${s.reason} |`,
    )
  })
  return lines.join('\n')
}
