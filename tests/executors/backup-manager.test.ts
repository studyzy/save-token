import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const TMP = '/tmp/st-test-backup'

vi.mock('tinyexec', () => ({ exec: vi.fn() }))
vi.mock('../../src/utils/platform', () => ({
  getHomeDir: vi.fn(() => TMP),
  getCodebuddyDir: vi.fn(() => `${TMP}/.codebuddy`),
  commandExists: vi.fn(),
  getPlatform: vi.fn(() => 'macos'),
  isWindows: vi.fn(() => false),
}))

import { backup, listBackups, restoreLatest, restoreByTimestamp } from '../../src/executors/backup-manager'
import { exists, readFile, writeFile, removeFile, ensureDir, readDir } from '../../src/utils/fs-operations'

const SAMPLE_REPORT = {
  scanTimestamp: '',
  codebuddyVersion: null,
  platform: 'macos' as const,
  contextOverview: { totalEstimatedTokens: 0, breakdown: [] },
  mcpList: [],
  skillList: [],
  pluginList: [],
  hookList: [],
  configFiles: [],
  toolDetection: [],
  headlessAvailable: false,
  warnings: [],
}

describe('backup-manager', () => {
  beforeEach(() => {
    const cbDir = `${TMP}/.codebuddy`
    ensureDir(cbDir)
    writeFile(`${cbDir}/.mcp.json`, '{"mcpServers":{}}')
    writeFile(`${cbDir}/settings.json`, '{"enabledPlugins":{}}')
    writeFile(`${cbDir}/CODEBUDDY.md`, '# test')
  })

  afterEach(() => {
    const cbDir = `${TMP}/.codebuddy`
    if (exists(cbDir)) {
      for (const f of readDir(cbDir)) {
        removeFile(`${cbDir}/${f}`)
      }
    }
  })

  it('should create backup files with timestamp', async () => {
    const timestamp = await backup(SAMPLE_REPORT)
    expect(timestamp).toMatch(/^\d{14}$/)
    expect(exists(`${TMP}/.codebuddy/.mcp.json.bak.${timestamp}`)).toBe(true)
    expect(exists(`${TMP}/.codebuddy/settings.json.bak.${timestamp}`)).toBe(true)
    expect(exists(`${TMP}/.codebuddy/CODEBUDDY.md.bak.${timestamp}`)).toBe(true)
    expect(exists(`${TMP}/.codebuddy/.st-backup-${timestamp}.json`)).toBe(true)
  })

  it('should list backups sorted desc', async () => {
    const ts1 = await backup(SAMPLE_REPORT)
    await new Promise(r => setTimeout(r, 1100))
    const ts2 = await backup(SAMPLE_REPORT)
    const backups = await listBackups()
    expect(backups.length).toBeGreaterThanOrEqual(2)
    expect(backups[0]!.timestamp).toBe(ts2)
    expect(backups[1]!.timestamp).toBe(ts1)
  })

  it('should restore latest backup', async () => {
    const cbDir = `${TMP}/.codebuddy`
    writeFile(`${cbDir}/.mcp.json`, '{"mcpServers":{"test":{}}}')
    await backup(SAMPLE_REPORT)
    writeFile(`${cbDir}/.mcp.json`, '{"mcpServers":{"changed":{}}}')
    const ok = await restoreLatest()
    expect(ok).toBe(true)
    expect(readFile(`${cbDir}/.mcp.json`)).toBe('{"mcpServers":{"test":{}}}')
  })

  it('should restore by timestamp', async () => {
    const timestamp = await backup(SAMPLE_REPORT)
    const ok = await restoreByTimestamp(timestamp)
    expect(ok).toBe(true)
  })

  it('should return false for non-existent timestamp', async () => {
    const ok = await restoreByTimestamp('99990101000000')
    expect(ok).toBe(false)
  })
})
