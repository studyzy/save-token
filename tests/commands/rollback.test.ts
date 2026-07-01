import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('tinyexec', () => ({ exec: vi.fn() }))
vi.mock('../../src/utils/platform', () => ({
  getHomeDir: vi.fn(() => '/tmp/st-rollback-test'),
  getCodebuddyDir: vi.fn(() => '/tmp/st-rollback-test/.codebuddy'),
  commandExists: vi.fn(),
  getPlatform: vi.fn(() => 'macos'),
  isWindows: vi.fn(() => false),
}))

import { rollback } from '../../src/commands/rollback'
import { ensureDir, writeFile, removeFile, exists, readDir, copyFile, readFile } from '../../src/utils/fs-operations'

const TMP = '/tmp/st-rollback-test'

describe('rollback command', () => {
  beforeEach(() => {
    const cbDir = `${TMP}/.codebuddy`
    ensureDir(cbDir)
    writeFile(`${cbDir}/.mcp.json`, '{"mcpServers":{"original":{}}}')
    writeFile(`${cbDir}/settings.json`, '{"enabledPlugins":{}}')
    writeFile(`${cbDir}/CODEBUDDY.md`, '# test')
    // Create a backup manually
    const ts = '20260101120000'
    copyFile(`${cbDir}/.mcp.json`, `${cbDir}/.mcp.json.bak.${ts}`)
    writeFile(`${cbDir}/.st-backup-${ts}.json`, JSON.stringify({
      timestamp: ts,
      operation: 'optimize',
      files: [{ originalPath: `${cbDir}/.mcp.json`, backupPath: `${cbDir}/.mcp.json.bak.${ts}`, fileSize: 30 }],
    }))
    // Modify current to verify restore
    writeFile(`${cbDir}/.mcp.json`, '{"mcpServers":{"modified":{}}}')
  })

  afterEach(() => {
    const cbDir = `${TMP}/.codebuddy`
    if (exists(cbDir)) {
      for (const f of readDir(cbDir)) {
        removeFile(`${cbDir}/${f}`)
      }
    }
  })

  it('should restore latest backup', async () => {
    const logs: string[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '))
    })

    await rollback({})

    // Verify restored content
    const content = readFile(`${TMP}/.codebuddy/.mcp.json`)
    expect(content).toBe('{"mcpServers":{"original":{}}}')
    expect(logs.some(l => l.includes('Restored') || l.includes('恢复'))).toBe(true)

    spy.mockRestore()
  })

  it('should error when no backups found', async () => {
    // Remove backups
    const cbDir = `${TMP}/.codebuddy`
    for (const f of readDir(cbDir)) {
      if (f.startsWith('.st-backup') || f.includes('.bak.')) {
        removeFile(`${cbDir}/${f}`)
      }
    }

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit ${code}`)
    })

    await expect(rollback({})).rejects.toThrow('exit 1')

    errSpy.mockRestore()
    exitSpy.mockRestore()
  })
})
