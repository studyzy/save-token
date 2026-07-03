import { describe, it, expect, vi, beforeEach } from 'vitest'
import { probe } from '../../src/collectors/headless-collector'
import type { PlatformAdapter } from '../../src/adapters/platform-adapter'

vi.mock('tinyexec', () => ({
  exec: vi.fn(),
}))

import { exec } from 'tinyexec'

const mockAdapter: PlatformAdapter = {
  name: 'mock',
  // eslint-disable-next-line @typescript-eslint/require-await
  async detectInstall() {
    return true
  },
  getConfigPaths() {
    return {
      mcp: '/mock/.mcp.json',
      settings: '/mock/settings.json',
      codebuddyMd: '/mock/CODEBUDDY.md',
      skillsDir: '/mock/skills',
      commandsDir: '/mock/commands',
      rulesDir: '/mock/rules',
      agentsDir: '/mock/agents',
      pluginsMarketplacesDir: '/mock/plugins/marketplaces',
      historyFile: '/mock/history.jsonl',
      blobsDir: '/mock/blobs',
      cliBinary: 'mockcli',
    }
  },
  getHeadlessCommand(prompt: string) {
    return ['-p', prompt]
  },
  parseHeadlessOutput(raw: string) {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  },
}

describe('headless-collector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return ok=true when exec succeeds and output is valid JSON', async () => {
    vi.mocked(exec).mockResolvedValue({
      stdout: '{"key":"value"}',
      stderr: '',
      exitCode: 0,
    })

    const result = await probe(mockAdapter, 'test prompt')

    expect(result.ok).toBe(true)
    expect(result.parsed).toEqual({ key: 'value' })
    expect(result.exitCode).toBe(0)
  })

  it('should return ok=false when exit code is non-zero', async () => {
    vi.mocked(exec).mockResolvedValue({
      stdout: '',
      stderr: 'error',
      exitCode: 1,
    })

    const result = await probe(mockAdapter, 'test prompt')

    expect(result.ok).toBe(false)
    expect(result.error).toContain('exit code 1')
  })

  it('should return ok=false when exec throws', async () => {
    vi.mocked(exec).mockRejectedValue(new Error('timeout'))

    const result = await probe(mockAdapter, 'test prompt')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('timeout')
  })

  it('should return ok=false when output is not valid JSON', async () => {
    vi.mocked(exec).mockResolvedValue({
      stdout: 'not json',
      stderr: '',
      exitCode: 0,
    })

    const result = await probe(mockAdapter, 'test prompt')

    expect(result.ok).toBe(false)
    expect(result.parsed).toBeNull()
  })
})
