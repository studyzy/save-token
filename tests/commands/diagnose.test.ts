import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('tinyexec', () => ({ exec: vi.fn() }))
vi.mock('../../src/utils/platform', () => ({
  getHomeDir: vi.fn(() => '/tmp/st-diagnose-test'),
  getCodebuddyDir: vi.fn(() => '/tmp/st-diagnose-test/.codebuddy'),
  commandExists: vi.fn(),
  getPlatform: vi.fn(() => 'macos'),
  isWindows: vi.fn(() => false),
}))

import { runDiagnose } from '../../src/commands/diagnose'
import { CodeBuddyAdapter } from '../../src/adapters/codebuddy-adapter'
import { ensureDir, writeFile, removeFile, exists, readDir } from '../../src/utils/fs-operations'
import { commandExists } from '../../src/utils/platform'
import * as tinyexec from 'tinyexec'

const TMP = '/tmp/st-diagnose-test'

describe('diagnose command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(commandExists).mockResolvedValue(true)
    vi.mocked(tinyexec.exec).mockResolvedValue({ stdout: 'codebuddy 2.114.1\n', stderr: '', exitCode: 0 } as any)

    const cbDir = `${TMP}/.codebuddy`
    ensureDir(cbDir)
    writeFile(
      `${cbDir}/.mcp.json`,
      JSON.stringify({ mcpServers: { test: { type: 'stdio', command: 'test' } } }, null, 2),
    )
    writeFile(`${cbDir}/settings.json`, JSON.stringify({ enabledPlugins: {} }))
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

  it('should produce DiagnosisReport with noHeadless=true', async () => {
    const adapter = new CodeBuddyAdapter()
    const report = await runDiagnose(adapter, { noHeadless: true })

    expect(report.scanTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(report.platform).toBe('macos')
    expect(report.headlessAvailable).toBe(false)
    expect(report.mcpList.length).toBe(1)
    expect(report.mcpList[0]!.name).toBe('test')
    expect(Array.isArray(report.toolDetection)).toBe(true)
    expect(report.toolDetection.length).toBe(5)
  })

  it('should warn when codebuddy not installed', async () => {
    vi.mocked(commandExists).mockResolvedValue(false)
    const adapter = new CodeBuddyAdapter()
    const report = await runDiagnose(adapter, { noHeadless: true })

    expect(report.warnings.length).toBeGreaterThan(0)
    expect(report.codebuddyVersion).toBeNull()
  })
})
