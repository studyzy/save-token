import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { platform } from 'node:os'
import process from 'node:process'

vi.mock('node:os', () => ({
  platform: vi.fn(),
}))

// We need to use dynamic import because the module uses os.platform() at import time
describe('platform utilities', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.mocked(platform).mockReturnValue('darwin')
    // Reset relevant env vars
    delete process.env.PREFIX
    delete process.env.TERMUX_VERSION
  })

  afterEach(() => {
    delete process.env.PREFIX
    delete process.env.TERMUX_VERSION
  })

  it('getPlatform should detect macos', async () => {
    vi.mocked(platform).mockReturnValue('darwin')
    const { getPlatform } = await import('../../src/utils/platform')
    expect(getPlatform()).toBe('macos')
  })

  it('getPlatform should detect windows', async () => {
    vi.mocked(platform).mockReturnValue('win32')
    const { getPlatform } = await import('../../src/utils/platform')
    expect(getPlatform()).toBe('windows')
  })

  it('getPlatform should detect linux', async () => {
    vi.mocked(platform).mockReturnValue('linux')
    const { getPlatform } = await import('../../src/utils/platform')
    expect(getPlatform()).toBe('linux')
  })

  it('isWindows should return false on macos', async () => {
    vi.mocked(platform).mockReturnValue('darwin')
    const { isWindows } = await import('../../src/utils/platform')
    expect(isWindows()).toBe(false)
  })

  it('isWindows should return true on windows', async () => {
    vi.mocked(platform).mockReturnValue('win32')
    const { isWindows } = await import('../../src/utils/platform')
    expect(isWindows()).toBe(true)
  })

  it('isTermux should return false without termux env', async () => {
    const { isTermux } = await import('../../src/utils/platform')
    expect(isTermux()).toBe(false)
  })

  it('isTermux should detect termux via PREFIX', async () => {
    process.env.PREFIX = '/data/data/com.termux/files/usr'
    const { isTermux } = await import('../../src/utils/platform')
    expect(isTermux()).toBe(true)
  })

  it('isTermux should detect termux via TERMUX_VERSION', async () => {
    process.env.TERMUX_VERSION = '0.118.0'
    const { isTermux } = await import('../../src/utils/platform')
    expect(isTermux()).toBe(true)
  })

  it('getTermuxPrefix should return env PREFIX', async () => {
    process.env.PREFIX = '/custom/prefix'
    const { getTermuxPrefix } = await import('../../src/utils/platform')
    expect(getTermuxPrefix()).toBe('/custom/prefix')
  })

  it('getTermuxPrefix should return default on missing PREFIX', async () => {
    const { getTermuxPrefix } = await import('../../src/utils/platform')
    expect(getTermuxPrefix()).toBe('/data/data/com.termux/files/usr')
  })

  it('shouldUseSudoForGlobalInstall should return false on macos', async () => {
    vi.mocked(platform).mockReturnValue('darwin')
    const { shouldUseSudoForGlobalInstall } = await import('../../src/utils/platform')
    expect(shouldUseSudoForGlobalInstall()).toBe(false)
  })

  it('wrapCommandWithSudo should not wrap on macos', async () => {
    vi.mocked(platform).mockReturnValue('darwin')
    const { wrapCommandWithSudo } = await import('../../src/utils/platform')
    const result = wrapCommandWithSudo('npm', ['install', '-g', 'foo'])
    expect(result.command).toBe('npm')
    expect(result.usedSudo).toBe(false)
  })

  it('getHomeDir should return HOME env var', async () => {
    const { getHomeDir } = await import('../../src/utils/platform')
    const home = getHomeDir()
    expect(home).toBeDefined()
    expect(typeof home).toBe('string')
  })

  it('getCodebuddyDir should end with .codebuddy', async () => {
    const { getCodebuddyDir } = await import('../../src/utils/platform')
    const dir = getCodebuddyDir()
    expect(dir.endsWith('/.codebuddy')).toBe(true)
  })

  it('joinPath should join segments', async () => {
    const { joinPath } = await import('../../src/utils/platform')
    expect(joinPath('a', 'b', 'c')).toBe('a/b/c')
  })

  it('joinPath should normalize double slashes', async () => {
    const { joinPath } = await import('../../src/utils/platform')
    expect(joinPath('a/', '/b')).toBe('a/b')
  })
})
