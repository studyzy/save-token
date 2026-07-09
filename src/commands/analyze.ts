import type { AnalyzeOptions, UsageScenario, ProjectProfile } from '../types'
import type { DiagnosisReport, OptimizationSuggestion } from '../types'
import { CodeBuddyAdapter } from '../adapters/codebuddy-adapter'
import { runDiagnose } from './diagnose'
import { generateSuggestions } from '../analyzers/suggestion-engine'
import { printSuggestions } from '../utils/output'
import { writeFile, exists, readJsonFile } from '../utils/fs-operations'
import { getResourceDir } from '../utils/resource-dir'
import { handleExitPromptError, handleGeneralError } from '../utils/error-handler'
import { askScenario } from '../utils/scenario-prompt'
import { scanProjectProfile } from '../utils/project-scanner'
import { callLlmForRemovalAdvice, fallbackRemovalSuggestions } from '../utils/llm-analyzer'

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

export async function analyze(options: AnalyzeOptions): Promise<void> {
  try {
    // Step 1: Collect scenario and project profile
    const scenario: UsageScenario = await askScenario()
    console.log('')
    console.log(`  使用场景: ${scenarioLabel(scenario)}`)
    console.log('  正在扫描项目目录...')
    const projectProfile: ProjectProfile = scanProjectProfile()
    console.log(
      `  代码文件: ${projectProfile.codeFileCount}, 文档文件: ${projectProfile.docFileCount}`,
    )
    if (projectProfile.isLargeCodebase) console.log('  检测到大代码量项目')
    if (projectProfile.hasLargeDocs) console.log('  检测到大量文档')
    console.log('')

    // Step 2: Diagnose — reuse cached report if available
    const cachePath = `${getResourceDir()}/diagnosis-report.json`
    let report: DiagnosisReport
    if (exists(cachePath)) {
      console.log('  使用缓存的诊断报告 (save-token-resource/diagnosis-report.json)')
      const cached = readJsonFile<DiagnosisReport>(cachePath)
      if (cached) {
        report = cached
      } else {
        console.log('  缓存文件损坏，重新执行诊断...')
        const adapter = new CodeBuddyAdapter()
        const result = await runDiagnose(adapter, options)
        report = result.report
        console.log(`  诊断完成，数据来源: ${report.dataSource}`)
      }
    } else {
      console.log('  正在执行诊断...（文件扫描 + codebuddy -p 探针 + Proxy 拦截）')
      const adapter = new CodeBuddyAdapter()
      const result = await runDiagnose(adapter, options)
      report = result.report
      console.log(`  诊断完成，数据来源: ${report.dataSource}`)
    }

    // Inject scenario and project profile into report
    report.scenario = scenario
    report.projectProfile = projectProfile

    // Step 3: Generate tool install suggestions (hardcoded rules)
    const hardcodedSuggestions = generateSuggestions(report, scenario, projectProfile)

    // Step 4: Get LLM-driven removal suggestions
    console.log('  正在调用 AI 分析 Skill/Plugin/MCP 移除建议...')
    const llmSuggestions = await callLlmForRemovalAdvice(report, scenario, projectProfile)

    // Fallback to hardcoded removal rules if LLM returns nothing
    const removalSuggestions =
      llmSuggestions.length > 0 ? llmSuggestions : fallbackRemovalSuggestions(report, scenario)

    if (llmSuggestions.length === 0) {
      console.log('  AI 分析不可用，使用规则引擎')
    }
    console.log('')

    // Merge and sort
    const allSuggestions = [...hardcodedSuggestions, ...removalSuggestions].sort(
      (a, b) => b.estimatedSavingTokens - a.estimatedSavingTokens,
    )

    const totalSaving = allSuggestions.reduce((s, x) => s + x.estimatedSavingTokens, 0)
    const totalPercent = report.contextOverview.totalEstimatedTokens
      ? (totalSaving / report.contextOverview.totalEstimatedTokens) * 100
      : 0

    printSuggestions(allSuggestions, totalSaving, totalPercent, options.format ?? 'terminal')

    if (options.report) {
      const content =
        options.format === 'json'
          ? JSON.stringify(
              { report, suggestions: allSuggestions, totalSaving, totalPercent },
              null,
              2,
            )
          : renderAnalyzeMd(report, allSuggestions, totalSaving, totalPercent)
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
