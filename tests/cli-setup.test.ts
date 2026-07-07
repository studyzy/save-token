/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/i18n', () => ({
  initI18n: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/commands/diagnose', () => ({
  diagnose: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/commands/analyze', () => ({
  analyze: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/commands/optimize', () => ({
  optimize: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/commands/rollback', () => ({
  rollback: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/commands/report', () => ({
  report: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/commands/trace', () => ({
  trace: vi.fn().mockResolvedValue(undefined),
}))

import { setupCommands } from '../src/cli-setup'

describe('cli-setup', () => {
  it('should register 6 commands on cli', async () => {
    const registeredCommands: string[] = []
    const mockCli = {
      command(name: string) {
        registeredCommands.push(name)
        return {
          option() {
            return this
          },
          action() {
            return this
          },
        }
      },
    }

    await setupCommands(mockCli as any)

    expect(registeredCommands).toEqual([
      'diagnose',
      'analyze',
      'optimize',
      'rollback',
      'report',
      'trace',
    ])
  })

  it('should use zh-CN language by default', async () => {
    const { initI18n } = await import('../src/i18n')

    const mockCli = {
      command() {
        return {
          option() {
            return this
          },
          action() {
            return this
          },
        }
      },
    }

    await setupCommands(mockCli as any)
    expect(initI18n).toHaveBeenCalledWith('zh-CN')
  })

  it('should respect ST_LANG env var', async () => {
    const { initI18n } = await import('../src/i18n')
    vi.mocked(initI18n).mockClear()

    process.env.ST_LANG = 'en'
    const mockCli = {
      command() {
        return {
          option() {
            return this
          },
          action() {
            return this
          },
        }
      },
    }

    // Re-import to pick up new env var
    vi.resetModules()
    const { setupCommands: setupCommandsFresh } = await import('../src/cli-setup')

    await setupCommandsFresh(mockCli as any)
    expect(initI18n).toHaveBeenCalledWith('en')
    delete process.env.ST_LANG
  })
})
