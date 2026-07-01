import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('tinyexec', () => ({ exec: vi.fn() }))
vi.mock('../../src/utils/platform', () => ({
  getHomeDir: vi.fn(() => '/tmp/st-analyze-test'),
  getCodebuddyDir: vi.fn(() => '/tmp/st-analyze-test/.codebuddy'),
  commandExists: vi.fn(),
  getPlatform: vi.fn(() => 'macos'),
  isWindows: vi.fn(() => false),
}))

import { analyze } from '../../src/commands/analyze'
import { ensureDir, writeFile, removeFile, exists, readDir } from '../../src/utils/fs-operations'

const TMP = '/tmp/st-analyze-test'

describe('analyze command', () => {
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

  it('should run and output json without throwing', async () => {
    const logs: string[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '))
    })

    await analyze({ noHeadless: true, format: 'json' })

    expect(logs.length).toBeGreaterThan(0)
    const json = JSON.parse(logs[0]!)
    expect(json).toHaveProperty('suggestions')
    expect(json).toHaveProperty('totalEstimatedSaving')
    expect(json).toHaveProperty('totalPercent')

    spy.mockRestore()
  })
})
