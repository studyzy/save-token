import type { BackupFileEntry, BackupRecord, DiagnosisReport } from '../types'
import dayjs from 'dayjs'
import { exists, readFile, readDir, writeFile, copyFile, getStats } from '../utils/fs-operations'
import { getCodebuddyDir } from '../utils/platform'
import { CodeBuddyAdapter } from '../adapters/codebuddy-adapter'

const BACKUP_GLOB_PREFIX = '.st-backup-'

/**
 * Backup config files that may be modified, returning a timestamp string.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function backup(_report: DiagnosisReport): Promise<string> {
  const timestamp = dayjs().format('YYYYMMDDHHmmss')
  const adapter = new CodeBuddyAdapter()
  const paths = adapter.getConfigPaths()
  const files = [paths.mcp, paths.settings, paths.codebuddyMd]
  const entries: BackupFileEntry[] = []

  for (const file of files) {
    if (!exists(file)) continue
    const backupPath = `${file}.bak.${timestamp}`
    copyFile(file, backupPath)
    entries.push({
      originalPath: file,
      backupPath,
      fileSize: getStats(file).size,
    })
  }

  const record: BackupRecord = {
    timestamp,
    operation: 'optimize',
    files: entries,
  }
  const recordPath = `${getCodebuddyDir()}/${BACKUP_GLOB_PREFIX}${timestamp}.json`
  writeFile(recordPath, JSON.stringify(record, null, 2))

  return timestamp
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function listBackups(): Promise<BackupRecord[]> {
  const dir = getCodebuddyDir()
  if (!exists(dir)) return []
  const records: BackupRecord[] = []
  for (const entry of readDir(dir)) {
    if (!entry.startsWith(BACKUP_GLOB_PREFIX) || !entry.endsWith('.json')) continue
    try {
      const content = readFile(`${dir}/${entry}`)
      records.push(JSON.parse(content) as BackupRecord)
    } catch {
      // skip invalid
    }
  }
  return records.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

export async function restoreLatest(): Promise<boolean> {
  const backups = await listBackups()
  if (backups.length === 0) return false
  return restoreRecord(backups[0])
}

export async function restoreByTimestamp(timestamp: string): Promise<boolean> {
  const backups = await listBackups()
  const target = backups.find((b) => b.timestamp === timestamp)
  if (!target) return false
  return restoreRecord(target)
}

function restoreRecord(record: BackupRecord): boolean {
  for (const entry of record.files) {
    if (!exists(entry.backupPath)) continue
    copyFile(entry.backupPath, entry.originalPath)
  }
  return true
}

export type { BackupFileEntry, BackupRecord }
