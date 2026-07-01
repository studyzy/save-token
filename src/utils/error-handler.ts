import process from 'node:process'
import ansis from 'ansis'
import { ensureI18nInitialized, i18n } from '../i18n'

/**
 * Handle ExitPromptError gracefully (user pressed Ctrl+C during prompt).
 * @returns true if error was ExitPromptError and handled, false otherwise.
 */
export function handleExitPromptError(error: unknown): boolean {
  const isExitError =
    error instanceof Error &&
    (error.name === 'ExitPromptError' ||
      error.message?.includes('ExitPromptError') ||
      error.message?.includes('User force closed the prompt'))
  if (isExitError) {
    ensureI18nInitialized()
    console.log(ansis.cyan(`\n${i18n.t('common:goodbye')}\n`))
    process.exit(0)
  }
  return false
}

/**
 * Handle general errors with proper formatting.
 */
export function handleGeneralError(error: unknown): void {
  ensureI18nInitialized()
  console.error(ansis.red(`${i18n.t('errors:generalError')}:`), error)
  if (error instanceof Error) {
    console.error(ansis.gray(`${i18n.t('errors:stackTrace')}: ${error.stack}`))
  }
  process.exit(1)
}

/**
 * Wrap an async command action with unified error handling.
 */
export function withErrorHandler<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<void>,
): (...args: TArgs) => Promise<void> {
  return async (...args: TArgs) => {
    try {
      await fn(...args)
    } catch (error) {
      if (!handleExitPromptError(error)) {
        handleGeneralError(error)
      }
    }
  }
}
