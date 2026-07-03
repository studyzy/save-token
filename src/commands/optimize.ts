import type { OptimizeOptions, OptimizationSuggestion, ToolId } from '../types'
import type { DiagnosisReport } from '../types'
import { CodeBuddyAdapter } from '../adapters/codebuddy-adapter'
import { runDiagnose } from './diagnose'
import { generateSuggestions } from '../analyzers/suggestion-engine'
import { installTool } from '../executors/tool-installer'
import { applyConfigChange } from '../executors/codebuddy-configurator'
import { backup } from '../executors/backup-manager'
import { printOptimizePreview } from '../utils/output'
import { handleExitPromptError, handleGeneralError } from '../utils/error-handler'
import { exists, removeFile, writeFile } from '../utils/fs-operations'
import { getCodebuddyDir } from '../utils/platform'
import { i18n } from '../i18n'
import ansis from 'ansis'

const LOCK_FILE = `${getCodebuddyDir()}/.st.lock`

export async function optimize(options: OptimizeOptions): Promise<void> {
  try {
    const adapter = new CodeBuddyAdapter()
    const { report } = await runDiagnose(adapter, { noHeadless: false })
    const allSuggestions = generateSuggestions(report)
    const suggestions = filterSuggestions(allSuggestions, options)

    const isDryRun = !options.apply
    printOptimizePreview(suggestions, isDryRun)

    if (isDryRun) {
      console.log(ansis.gray(`\n运行 ${ansis.cyan('st optimize --apply')} 执行\n`))
      return
    }

    if (!options.yes) {
      const confirmed = await confirmWithUser(suggestions)
      if (!confirmed) {
        console.log(ansis.gray(i18n.t('common:cancelled')))
        return
      }
    }

    if (exists(LOCK_FILE)) {
      console.error(ansis.red(i18n.t('errors:lockFileExists')))
      process.exit(2)
    }
    writeFile(LOCK_FILE, String(Date.now()))

    try {
      const backupTimestamp = await backup(report)
      const results = []
      for (const s of suggestions) {
        const r = await executeSuggestion(s, report)
        results.push({ suggestion: s, result: r })
      }
      printResults(results)
      writeBackupRecord(backupTimestamp, results)
    } finally {
      removeFile(LOCK_FILE)
    }
  } catch (error) {
    if (!handleExitPromptError(error)) handleGeneralError(error)
  }
}

function filterSuggestions(
  all: OptimizationSuggestion[],
  options: OptimizeOptions,
): OptimizationSuggestion[] {
  if (options.tool) {
    return all.filter(
      (s) => s.actionPayload.installCommand?.includes(options.tool!) || s.target === options.tool,
    )
  }
  if (options.suggestion) {
    return all.filter((s) => s.id === options.suggestion)
  }
  return all
}

// eslint-disable-next-line @typescript-eslint/require-await
async function confirmWithUser(_suggestions: OptimizationSuggestion[]): Promise<boolean> {
  return true
}

async function executeSuggestion(
  suggestion: OptimizationSuggestion,
  _report: DiagnosisReport,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (suggestion.type === 'install_tool') {
      const toolId = suggestion.target as ToolId
      const r = await installTool(toolId)
      return { success: r.success, error: r.error }
    }
    if (suggestion.type === 'config_change') {
      const r = await applyConfigChange(suggestion)
      return { success: r.success, error: r.error }
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function printResults(
  results: Array<{
    suggestion: OptimizationSuggestion
    result: { success: boolean; error?: string }
  }>,
): void {
  for (const r of results) {
    const mark = r.result.success ? ansis.green('✓') : ansis.red('✗')
    console.log(`${mark} ${r.suggestion.target}`)
    if (r.result.error) {
      console.log(ansis.gray(`  ${r.result.error}`))
    }
  }
}

function writeBackupRecord(
  timestamp: string,
  results: Array<{
    suggestion: OptimizationSuggestion
    result: { success: boolean; error?: string }
  }>,
): void {
  const record = {
    timestamp,
    operation: 'optimize' as const,
    files: [],
    results: results.map((r) => ({
      target: r.suggestion.target,
      success: r.result.success,
      error: r.result.error,
    })),
  }
  const recordPath = `${getCodebuddyDir()}/.st-backup-${timestamp}.json`
  writeFile(recordPath, JSON.stringify(record, null, 2))
}
