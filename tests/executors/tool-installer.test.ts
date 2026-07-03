import { describe, it, expect, vi, beforeEach } from 'vitest'
import { installTool } from '../../src/executors/tool-installer'

vi.mock('tinyexec', () => ({ exec: vi.fn() }))
vi.mock('../../src/utils/platform', () => ({
  commandExists: vi.fn(),
  getPlatform: vi.fn(() => 'macos'),
  isWindows: vi.fn(() => false),
  getHomeDir: vi.fn(() => '/tmp/test-home'),
  getCodebuddyDir: vi.fn(() => '/tmp/test-home/.codebuddy'),
}))

import { exec } from 'tinyexec'
import { commandExists } from '../../src/utils/platform'

describe('tool-installer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should skip install when tool already installed', async () => {
    vi.mocked(commandExists).mockResolvedValue(true)

    const result = await installTool('rtk')

    expect(result.success).toBe(true)
    expect(result.installOutput).toBe('already installed')
    expect(exec).not.toHaveBeenCalled()
  })

  it('should install and verify when not installed', async () => {
    vi.mocked(commandExists).mockResolvedValue(false)
    vi.mocked(exec).mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 })

    const result = await installTool('rtk')

    expect(result.success).toBe(true)
    // Should call exec 3 times: install, verify, config
    expect(exec).toHaveBeenCalledTimes(3)
  })

  it('should fail when install command fails', async () => {
    vi.mocked(commandExists).mockResolvedValue(false)
    vi.mocked(exec).mockResolvedValue({ stdout: '', stderr: 'install failed', exitCode: 1 })

    const result = await installTool('rtk')

    expect(result.success).toBe(false)
    expect(result.error).toContain('install failed')
  })

  it('should handle all tool IDs', async () => {
    vi.mocked(commandExists).mockResolvedValue(true)

    for (const id of ['rtk', 'caveman', 'headroom', 'lean-ctx', 'graphify'] as const) {
      const result = await installTool(id)
      expect(result.success).toBe(true)
    }
  })
})
