import type { DiagnosisReport, OptimizationSuggestion, OutputFormat } from '../types'
import ansis from 'ansis'

/**
 * Print optimize preview (dry-run or apply).
 */
export function printOptimizePreview(suggestions: OptimizationSuggestion[], isDryRun: boolean): void {
  const title = isDryRun ? '优化执行（dry-run）' : '优化执行（apply）'
  console.log(ansis.bold.cyan(title))
  console.log('='.repeat(50))
  if (suggestions.length === 0) {
    console.log(ansis.gray('无优化建议'))
    return
  }
  console.log(`将执行 ${suggestions.length} 项操作：`)
  console.log('')
  suggestions.forEach((s, i) => {
    const stars = '★'.repeat(Math.min(5, Math.max(1, Math.ceil(s.estimatedSavingTokens / 1000))))
    console.log(ansis.bold(`[${i + 1}] ${s.target} ${ansis.yellow(stars)}`))
    console.log(`    类型: ${s.type}`)
    console.log(`    预估节省: ${s.estimatedSavingTokens} tok (${s.estimatedSavingPercent.toFixed(1)}%)`)
    console.log(`    风险: ${s.risk}  可逆: ${s.reversible}`)
    console.log(`    原因: ${s.reason}`)
    if (s.actionPayload.installCommand) {
      console.log(`    $ ${ansis.gray(s.actionPayload.installCommand)}`)
    } else if (s.actionPayload.targetFile) {
      console.log(`    文件: ${ansis.gray(s.actionPayload.targetFile)}`)
      if (s.actionPayload.operation) console.log(`    操作: ${s.actionPayload.operation}`)
      if (s.actionPayload.fieldName) {
        console.log(`    字段: ${s.actionPayload.fieldName} = ${JSON.stringify(s.actionPayload.fieldValue)}`)
      }
    }
    console.log('')
  })
}

/**
 * Format and print a diagnosis report.
 */
export function printDiagnosisReport(report: DiagnosisReport, format: OutputFormat): void {
  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  if (format === 'md') {
    console.log(renderDiagnosisMarkdown(report))
    return
  }
  console.log(renderDiagnosisTerminal(report))
}

/**
 * Format and print optimization suggestions.
 */
export function printSuggestions(
  suggestions: OptimizationSuggestion[],
  totalSaving: number,
  totalPercent: number,
  format: OutputFormat,
): void {
  if (format === 'json') {
    console.log(
      JSON.stringify(
        { suggestions, totalEstimatedSaving: totalSaving, totalPercent },
        null,
        2,
      ),
    )
    return
  }
  if (format === 'md') {
    console.log(renderSuggestionsMarkdown(suggestions, totalSaving, totalPercent))
    return
  }
  console.log(renderSuggestionsTerminal(suggestions, totalSaving, totalPercent))
}

function renderDiagnosisTerminal(report: DiagnosisReport): string {
  const lines: string[] = []
  lines.push(ansis.bold.cyan('CodeBuddy Token 诊断报告'))
  lines.push('='.repeat(50))
  lines.push(`扫描时间: ${report.scanTimestamp}`)
  lines.push(`CodeBuddy 版本: ${report.codebuddyVersion ?? 'unknown'}`)
  lines.push(`平台: ${report.platform}`)
  lines.push('')
  lines.push(ansis.bold('上下文总览（估算）'))
  lines.push('-'.repeat(40))
  lines.push(`总估算 Token: ${ansis.yellow(String(report.contextOverview.totalEstimatedTokens))}`)
  lines.push('')
  lines.push('按占用降序:')
  const sorted = [...report.contextOverview.breakdown].sort(
    (a, b) => b.estimatedTokens - a.estimatedTokens,
  )
  for (const item of sorted) {
    const percent = report.contextOverview.totalEstimatedTokens
      ? ((item.estimatedTokens / report.contextOverview.totalEstimatedTokens) * 100).toFixed(1)
      : '0'
    lines.push(
      `  ${item.name.padEnd(25)} ${String(item.estimatedTokens).padStart(8)}  (${percent}%)`,
    )
  }
  lines.push('')
  lines.push(ansis.bold(`MCP 服务 (${report.mcpList.length} 个)`))
  lines.push('-'.repeat(40))
  for (const mcp of report.mcpList) {
    const mark = mcp.status === 'enabled' ? ansis.green('✓') : ansis.red('✗')
    const defer = mcp.deferLoading ? 'defer: true' : 'defer: false'
    const cli = mcp.hasCliAlternative ? ` (CLI: ${mcp.cliAlternative})` : ''
    lines.push(
      `  ${mark} ${mcp.name.padEnd(15)} [${mcp.type}] tools: ${mcp.toolsCount ?? '?'} ${defer} ~${mcp.estimatedTokens} tok${cli}`,
    )
  }
  lines.push('')
  lines.push(ansis.bold(`Skills (${report.skillList.length} 个)`))
  lines.push('-'.repeat(40))
  for (const skill of report.skillList.slice(0, 10)) {
    lines.push(
      `  [${skill.source}] ${skill.name.padEnd(20)} ~${skill.estimatedTokens} tok`,
    )
  }
  if (report.skillList.length > 10) {
    lines.push(`  ... ${report.skillList.length - 10} more`)
  }
  lines.push('')
  lines.push(ansis.bold(`插件 (${report.pluginList.filter(p => p.enabled).length} 个启用)`))
  lines.push('-'.repeat(40))
  for (const plugin of report.pluginList) {
    const mark = plugin.enabled ? ansis.green('✓') : ansis.gray('✗')
    const lf = plugin.isLowFrequency ? ansis.yellow(' [低频]') : ''
    lines.push(`  ${mark} ${plugin.id}${lf}`)
  }
  lines.push('')
  lines.push(ansis.bold(`Hooks (${report.hookList.length} 个)`))
  lines.push('-'.repeat(40))
  for (const hook of report.hookList) {
    const timeout = hook.timeout ? ` (${hook.timeout}s)` : ''
    lines.push(`  ${hook.event} [${hook.matcher}] → ${hook.command}${timeout}`)
  }
  lines.push('')
  lines.push(ansis.bold('配置文件'))
  lines.push('-'.repeat(40))
  for (const cfg of report.configFiles) {
    if (!cfg.exists) continue
    const level = cfg.impactLevel === 'high' ? ansis.red('[高]') : cfg.impactLevel === 'medium' ? ansis.yellow('[中]') : ansis.green('[低]')
    lines.push(
      `  ${cfg.path}  ${cfg.sizeBytes}B ${cfg.lineCount}行 ~${cfg.estimatedTokens}tok ${level}`,
    )
  }
  lines.push('')
  lines.push(ansis.bold('第三方工具检测'))
  lines.push('-'.repeat(40))
  for (const tool of report.toolDetection) {
    const mark = tool.installed ? ansis.green('✓') : ansis.red('✗')
    const integ = tool.codebuddyIntegrated ? '已集成' : '未集成'
    lines.push(`  ${mark} ${tool.name.padEnd(12)} ${tool.installed ? integ : '未安装'}  (${tool.recommendedSaving})`)
  }
  if (report.warnings.length > 0) {
    lines.push('')
    lines.push(ansis.bold.yellow('警告'))
    lines.push('-'.repeat(40))
    for (const w of report.warnings) {
      lines.push(`  - ${w}`)
    }
  }
  return lines.join('\n')
}

function renderDiagnosisMarkdown(report: DiagnosisReport): string {
  const lines: string[] = []
  lines.push('# CodeBuddy Token 诊断报告')
  lines.push('')
  lines.push(`- 扫描时间: ${report.scanTimestamp}`)
  lines.push(`- CodeBuddy 版本: ${report.codebuddyVersion ?? 'unknown'}`)
  lines.push(`- 平台: ${report.platform}`)
  lines.push('')
  lines.push('## 上下文总览（估算）')
  lines.push('')
  lines.push(`总估算 Token: **${report.contextOverview.totalEstimatedTokens}**`)
  lines.push('')
  lines.push('| 名称 | 类型 | 估算 Token | 来源 |')
  lines.push('| --- | --- | --- | --- |')
  for (const item of report.contextOverview.breakdown) {
    lines.push(`| ${item.name} | ${item.type} | ${item.estimatedTokens} | ${item.source} |`)
  }
  lines.push('')
  lines.push(`## MCP 服务 (${report.mcpList.length} 个)`)
  lines.push('')
  lines.push('| 名称 | 状态 | 类型 | 工具数 | defer | 估算 Token | CLI 替代 |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  for (const mcp of report.mcpList) {
    lines.push(
      `| ${mcp.name} | ${mcp.status} | ${mcp.type} | ${mcp.toolsCount ?? '?'} | ${mcp.deferLoading} | ${mcp.estimatedTokens} | ${mcp.cliAlternative ?? '-'} |`,
    )
  }
  lines.push('')
  lines.push(`## Skills (${report.skillList.length} 个)`)
  lines.push('')
  lines.push('| 名称 | 来源 | 估算 Token | 描述 |')
  lines.push('| --- | --- | --- | --- |')
  for (const skill of report.skillList) {
    lines.push(`| ${skill.name} | ${skill.source} | ${skill.estimatedTokens} | ${skill.description} |`)
  }
  lines.push('')
  lines.push(`## 插件 (${report.pluginList.filter(p => p.enabled).length} 个启用)`)
  lines.push('')
  lines.push('| ID | 启用 | 低频 |')
  lines.push('| --- | --- | --- |')
  for (const plugin of report.pluginList) {
    lines.push(`| ${plugin.id} | ${plugin.enabled} | ${plugin.isLowFrequency} |`)
  }
  lines.push('')
  lines.push(`## Hooks (${report.hookList.length} 个)`)
  lines.push('')
  lines.push('| 事件 | Matcher | 命令 | 超时 |')
  lines.push('| --- | --- | --- | --- |')
  for (const hook of report.hookList) {
    lines.push(`| ${hook.event} | ${hook.matcher} | ${hook.command} | ${hook.timeout ?? '-'} |`)
  }
  lines.push('')
  lines.push('## 配置文件')
  lines.push('')
  lines.push('| 路径 | 大小 | 行数 | 估算 Token | 影响 |')
  lines.push('| --- | --- | --- | --- | --- |')
  for (const cfg of report.configFiles) {
    if (!cfg.exists) continue
    lines.push(`| ${cfg.path} | ${cfg.sizeBytes}B | ${cfg.lineCount} | ${cfg.estimatedTokens} | ${cfg.impactLevel} |`)
  }
  lines.push('')
  lines.push('## 第三方工具检测')
  lines.push('')
  lines.push('| 工具 | 已安装 | 已集成 | 推荐节省 |')
  lines.push('| --- | --- | --- | --- |')
  for (const tool of report.toolDetection) {
    lines.push(`| ${tool.name} | ${tool.installed ? '✓' : '✗'} | ${tool.codebuddyIntegrated} | ${tool.recommendedSaving} |`)
  }
  if (report.warnings.length > 0) {
    lines.push('')
    lines.push('## 警告')
    lines.push('')
    for (const w of report.warnings) {
      lines.push(`- ${w}`)
    }
  }
  return lines.join('\n')
}

function renderSuggestionsTerminal(
  suggestions: OptimizationSuggestion[],
  totalSaving: number,
  totalPercent: number,
): string {
  const lines: string[] = []
  lines.push(ansis.bold.cyan('优化建议报告'))
  lines.push('='.repeat(50))
  lines.push(`预估总节省: ${ansis.yellow(String(totalSaving))} Token (${totalPercent.toFixed(1)}%)`)
  lines.push('')
  suggestions.forEach((s, i) => {
    const stars = '★'.repeat(Math.min(5, Math.max(1, Math.ceil(s.estimatedSavingTokens / 1000))))
    lines.push(ansis.bold(`[${i + 1}] ${s.target} ${ansis.yellow(stars)}`))
    lines.push(`    类型: ${s.type}`)
    lines.push(`    预估节省: ${s.estimatedSavingTokens} tok (${s.estimatedSavingPercent.toFixed(1)}%)`)
    lines.push(`    风险: ${s.risk}  可逆: ${s.reversible}`)
    lines.push(`    原因: ${s.reason}`)
    if (s.actionPayload.installCommand) {
      lines.push(`    动作: ${ansis.gray(s.actionPayload.installCommand)}`)
    } else if (s.actionPayload.targetFile) {
      lines.push(`    文件: ${s.actionPayload.targetFile}`)
    }
    lines.push('')
  })
  return lines.join('\n')
}

function renderSuggestionsMarkdown(
  suggestions: OptimizationSuggestion[],
  totalSaving: number,
  totalPercent: number,
): string {
  const lines: string[] = []
  lines.push('# 优化建议报告')
  lines.push('')
  lines.push(`预估总节省: **${totalSaving} Token (${totalPercent.toFixed(1)}%)**`)
  lines.push('')
  lines.push('| # | 目标 | 类型 | 节省 Token | 节省 % | 风险 | 可逆 | 原因 |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
  suggestions.forEach((s, i) => {
    lines.push(
      `| ${i + 1} | ${s.target} | ${s.type} | ${s.estimatedSavingTokens} | ${s.estimatedSavingPercent.toFixed(1)}% | ${s.risk} | ${s.reversible} | ${s.reason} |`,
    )
  })
  return lines.join('\n')
}
