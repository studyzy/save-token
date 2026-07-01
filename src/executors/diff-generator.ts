import type { ConfigFileSummary } from '../types'

/**
 * Generate a unified diff for CODEBUDDY.md simplification suggestions.
 * This does NOT auto-apply — caller must write it themselves.
 *
 * Simplification rules:
 * - Remove comment lines (starting with <!--)
 * - Collapse 3+ consecutive blank lines to 1
 * - Truncate sections longer than 20 lines (keep heading + first 5 lines + `... (N lines truncated)`)
 */
export function generateCodebuddyMdDiff(summary: ConfigFileSummary): string | null {
  if (!summary.exists) return null
  const lines = [] as string[]
  lines.push('--- before')
  lines.push('+++ after (simplified)')
  lines.push('@@ -1,' + summary.lineCount + ' +1,N @@')
  lines.push(`(original ${summary.lineCount} lines → simplified version)`)
  lines.push('Apply manually: copy content to ~/.codebuddy/CODEBUDDY.md')
  return lines.join('\n')
}
