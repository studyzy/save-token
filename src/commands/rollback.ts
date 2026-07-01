import type { RollbackOptions } from '../types'
import { restoreLatest, restoreByTimestamp, listBackups } from '../executors/backup-manager'
import { handleExitPromptError, handleGeneralError } from '../utils/error-handler'
import { i18n } from '../i18n'
import ansis from 'ansis'

export async function rollback(options: RollbackOptions): Promise<void> {
  try {
    if (options.to) {
      const ok = await restoreByTimestamp(options.to)
      if (ok) {
        console.log(ansis.green(i18n.t('errors:rollbackSuccess')))
      } else {
        console.error(ansis.red(i18n.t('errors:backupNotFound', { timestamp: options.to })))
        process.exit(1)
      }
      return
    }
    const backups = await listBackups()
    if (backups.length === 0) {
      console.error(ansis.red(i18n.t('errors:noBackupFound')))
      process.exit(1)
    }
    const ok = await restoreLatest()
    if (ok) {
      console.log(ansis.green(i18n.t('errors:rollbackSuccess')))
    } else {
      console.error(ansis.red(i18n.t('errors:rollbackFailed')))
      process.exit(1)
    }
  } catch (error) {
    if (!handleExitPromptError(error)) handleGeneralError(error)
  }
}
