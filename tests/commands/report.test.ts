import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('tinyexec', () => ({ exec: vi.fn() }))
vi.mock('../../src/utils/platform', () => ({
  getHomeDir: vi.fn(() => '/tmp/st-report-test'),
  getCodebuddyDir: vi.fn(() => '/tmp/st-report-test/.codebuddy'),
  commandExists: vi.fn(),
  getPlatform: vi.fn(() => 'macos'),
  isWindows: vi.fn(() => false),
}))

import { report } from '../../src/commands/report'
import {
  ensureDir,
  writeFile,
  removeFile,
  exists,
  readDir,
  readFile,
} from '../../src/utils/fs-operations'

const TMP = '/tmp/st-report-test'

describe('report command', () => {
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
    if (exists(`${TMP}/report.md`)) removeFile(`${TMP}/report.md`)
    if (exists(`${TMP}/report.json`)) removeFile(`${TMP}/report.json`)
  })

  it('should write markdown report', async () => {
    const logs: string[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '))
    })

    await report({ format: 'md', output: `${TMP}/report.md`, noHeadless: true })

    expect(exists(`${TMP}/report.md`)).toBe(true)
    const content = readFile(`${TMP}/report.md`)
    expect(content).toContain('# save-token 完整报告')
    expect(content).toContain('诊断')
    expect(content).toContain('优化建议')

    spy.mockRestore()
  })

  it('should write json report', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await report({ format: 'json', output: `${TMP}/report.json`, noHeadless: true })

    expect(exists(`${TMP}/report.json`)).toBe(true)
    const json = JSON.parse(readFile(`${TMP}/report.json`)) as Record<string, unknown>
    expect(json).toHaveProperty('report')
    expect(json).toHaveProperty('suggestions')

    spy.mockRestore()
  })
})
