import { describe, it, expect, vi } from 'vitest'
import { handleExitPromptError, withErrorHandler } from '../../src/utils/error-handler'

describe('error-handler', () => {
  it('should return false for non-exit errors', () => {
    const err = new Error('normal error')
    expect(handleExitPromptError(err)).toBe(false)
  })

  it('should return false for non-Error values', () => {
    expect(handleExitPromptError('string error')).toBe(false)
    expect(handleExitPromptError(null)).toBe(false)
    expect(handleExitPromptError(undefined)).toBe(false)
  })

  it('should detect ExitPromptError by name', () => {
    const err = new Error('closed')
    err.name = 'ExitPromptError'
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exited')
    })
    expect(() => handleExitPromptError(err)).toThrow('exited')
    exitSpy.mockRestore()
  })

  it('should detect ExitPromptError by message', () => {
    const err = new Error('User force closed the prompt')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exited')
    })
    expect(() => handleExitPromptError(err)).toThrow('exited')
    exitSpy.mockRestore()
  })

  it('withErrorHandler should catch errors', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exited')
    })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // eslint-disable-next-line @typescript-eslint/require-await
    const fn = withErrorHandler(async () => {
      throw new Error('boom')
    })
    await expect(fn()).rejects.toThrow('exited')

    exitSpy.mockRestore()
    errSpy.mockRestore()
  })
})
