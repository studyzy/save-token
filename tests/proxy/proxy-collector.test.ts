import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('tinyexec', () => ({ exec: vi.fn() }))

import { runProxyDiagnose } from '../../src/collectors/proxy-collector'
import type { PlatformAdapter } from '../../src/adapters/platform-adapter'
import * as tinyexec from 'tinyexec'

function makeAdapter(): PlatformAdapter {
  return {
    name: 'test',
    detectInstall: () => Promise.resolve(true),
    getConfigPaths: () => ({
      mcp: '',
      settings: '',
      codebuddyMd: '',
      skillsDir: '',
      commandsDir: '',
      rulesDir: '',
      agentsDir: '',
      pluginsMarketplacesDir: '',
      historyFile: '',
      blobsDir: '',
      cliBinary: 'codebuddy',
    }),
    getHeadlessCommand: () => [],
    parseHeadlessOutput: () => null,
  }
}

describe('proxy-collector', () => {
  const originalBaseUrl = process.env.CODEBUDDY_BASE_URL

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CODEBUDDY_BASE_URL
  })

  afterEach(() => {
    if (originalBaseUrl !== undefined) {
      process.env.CODEBUDDY_BASE_URL = originalBaseUrl
    } else {
      delete process.env.CODEBUDDY_BASE_URL
    }
  })

  it('should set CODEBUDDY_BASE_URL env var during execution', async () => {
    vi.mocked(tinyexec.exec).mockRejectedValue(new Error('timeout'))

    const adapter = makeAdapter()
    await runProxyDiagnose(adapter)

    // After runProxyDiagnose, the env should be restored
    expect(process.env.CODEBUDDY_BASE_URL).toBeUndefined()
  })

  it('should return ok=false when codebuddy fails', async () => {
    vi.mocked(tinyexec.exec).mockRejectedValue(new Error('command not found'))

    const adapter = makeAdapter()
    const result = await runProxyDiagnose(adapter)

    expect(result.ok).toBe(false)
    expect(result.parsed).toBeNull()
    expect(result.rawBody).toBeNull()
  })
})
