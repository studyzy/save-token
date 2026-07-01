import type { CAC } from 'cac'
import { initI18n } from './i18n'
import { diagnose } from './commands/diagnose'
import { analyze } from './commands/analyze'
import { optimize } from './commands/optimize'
import { rollback } from './commands/rollback'
import { report } from './commands/report'

export async function setupCommands(cli: CAC): Promise<void> {
  const lang = (process.env.ST_LANG as 'zh-CN' | 'en' | undefined) ?? 'zh-CN'
  await initI18n(lang)

  cli
    .command('diagnose', '扫描 CodeBuddy 环境并输出诊断报告')
    .option('--format <format>', '输出格式: terminal | json | md', { default: 'terminal' })
    .option('--no-headless', '跳过 codebuddy -p 调用，仅文件扫描')
    .option('--report <path>', '同时将报告写入文件')
    .action(async (options) => {
      await diagnose({
        format: options.format,
        noHeadless: options.headless === false,
        report: options.report,
      })
    })

  cli
    .command('analyze', '基于诊断数据生成优化建议')
    .option('--format <format>', '输出格式: terminal | json | md', { default: 'terminal' })
    .option('--no-headless', '诊断阶段跳过 codebuddy -p')
    .option('--report <path>', '写入文件')
    .action(async (options) => {
      await analyze({
        format: options.format,
        noHeadless: options.headless === false,
        report: options.report,
      })
    })

  cli
    .command('optimize', '执行优化操作（安装工具 + 修改配置）')
    .option('--tool <id>', '只安装指定工具: rtk | caveman | headroom | lean-ctx | graphify')
    .option('--apply', '真实执行（默认 dry-run）')
    .option('--yes', '跳过确认')
    .option('--dry-run', '仅展示 diff（默认）')
    .option('--suggestion <id>', '只执行指定建议')
    .action(async (options) => {
      await optimize({
        tool: options.tool,
        apply: options.apply,
        yes: options.yes,
        dryRun: options.dryRun,
        suggestion: options.suggestion,
      })
    })

  cli
    .command('rollback', '从备份恢复')
    .option('--to <timestamp>', '恢复到指定时间戳')
    .action(async (options) => {
      await rollback({ to: options.to })
    })

  cli
    .command('report', '导出诊断+建议报告')
    .option('--format <format>', 'md | json', { default: 'md' })
    .option('--output <path>', '输出文件路径')
    .option('--no-headless', '诊断阶段跳过 codebuddy -p')
    .action(async (options) => {
      await report({ format: options.format, output: options.output, noHeadless: options.headless === false })
    })
}
