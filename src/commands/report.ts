import type { ReportOptions } from '../types'
import type { DiagnosisReport, OptimizationSuggestion } from '../types'
import { CodeBuddyAdapter } from '../adapters/codebuddy-adapter'
import { runDiagnose } from './diagnose'
import { generateSuggestions } from '../analyzers/suggestion-engine'
import { writeFile, ensureDir } from '../utils/fs-operations'
import { handleExitPromptError, handleGeneralError } from '../utils/error-handler'
import dayjs from 'dayjs'

export async function report(options: ReportOptions): Promise<void> {
  try {
    const adapter = new CodeBuddyAdapter()
    const { report } = await runDiagnose(adapter, { noHeadless: options.noHeadless ?? false })
    const suggestions = generateSuggestions(report)
    const totalSaving = suggestions.reduce((s, x) => s + x.estimatedSavingTokens, 0)
    const totalPercent = report.contextOverview.totalEstimatedTokens
      ? (totalSaving / report.contextOverview.totalEstimatedTokens) * 100
      : 0

    const format = options.format ?? 'md'
    const outputPath = options.output ?? `./st-report-${dayjs().format('YYYYMMDDHHmmss')}.${format}`
    ensureDir(outputPath.substring(0, outputPath.lastIndexOf('/')))

    const content =
      format === 'json'
        ? JSON.stringify({ report, suggestions, totalSaving, totalPercent }, null, 2)
        : renderFullReport(report, suggestions, totalSaving, totalPercent)

    writeFile(outputPath, content)
    console.log(`Report written to ${outputPath}`)
  } catch (error) {
    if (!handleExitPromptError(error)) handleGeneralError(error)
  }
}

function renderFullReport(
  report: DiagnosisReport,
  suggestions: OptimizationSuggestion[],
  totalSaving: number,
  totalPercent: number,
): string {
  const lines: string[] = []
  lines.push('# save-token 完整报告')
  lines.push('')
  lines.push(`生成时间: ${report.scanTimestamp}`)
  lines.push(`CodeBuddy 版本: ${report.codebuddyVersion ?? 'unknown'}`)
  lines.push(`平台: ${report.platform}`)
  lines.push('')
  lines.push('## 诊断')
  lines.push('')
  lines.push(`总估算 Token: ${report.contextOverview.totalEstimatedTokens}`)
  lines.push('')
  lines.push('| 名称 | 类型 | 估算 Token |')
  lines.push('| --- | --- | --- |')
  for (const item of report.contextOverview.breakdown) {
    lines.push(`| ${item.name} | ${item.type} | ${item.estimatedTokens} |`)
  }
  lines.push('')
  lines.push('## 优化建议')
  lines.push('')
  lines.push(`预估总节省: ${totalSaving} Token (${totalPercent.toFixed(1)}%)`)
  lines.push('')
  lines.push('| # | 目标 | 类型 | 节省 | 风险 | 原因 |')
  lines.push('| --- | --- | --- | --- | --- | --- |')
  suggestions.forEach((s, i) => {
    lines.push(
      `| ${i + 1} | ${s.target} | ${s.type} | ${s.estimatedSavingTokens} | ${s.risk} | ${s.reason} |`,
    )
  })
  return lines.join('\n')
}
