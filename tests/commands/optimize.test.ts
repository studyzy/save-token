import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('tinyexec', () => ({ exec: vi.fn() }))
vi.mock('../../src/utils/platform', () => ({
  getHomeDir: vi.fn(() => '/tmp/st-optimize-test'),
  getCodebuddyDir: vi.fn(() => '/tmp/st-optimize-test/.codebuddy'),
  commandExists: vi.fn(),
  getPlatform: vi.fn(() => 'macos'),
  isWindows: vi.fn(() => false),
}))

import { optimize } from '../../src/commands/optimize'
import { ensureDir, writeFile, removeFile, exists, readDir } from '../../src/utils/fs-operations'

const TMP = '/tmp/st-optimize-test'

describe('optimize command', () => {
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

  it('should run dry-run without modifying files', async () => {
    const logs: string[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '))
    })

    await optimize({ dryRun: true, yes: true, tool: 'lean-ctx' })

    // dry-run should not create lock file or backup files
    expect(exists(`${TMP}/.codebuddy/.st.lock`)).toBe(false)
    expect(logs.some(l => l.includes('dry-run') || l.includes('将执行') || l.includes('无优化'))).toBe(true)

    spy.mockRestore()
  })
})
