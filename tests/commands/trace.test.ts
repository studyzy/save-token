import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const startProxyMock = vi.fn()
const stopProxyMock = vi.fn()

vi.mock('../../src/proxy/server', () => ({
  startProxy: (...args: unknown[]) => startProxyMock(...args) as unknown,
  stopProxy: (...args: unknown[]) => stopProxyMock(...args) as unknown,
}))

vi.mock('../../src/utils/resource-dir', () => ({
  ensureResourceDir: vi.fn(() => '/tmp/st-trace-cmd-test/save-token-resource'),
}))

vi.mock('../../src/utils/error-handler', () => ({
  handleGeneralError: vi.fn((error: unknown) => {
    throw error
  }),
}))

import { trace } from '../../src/commands/trace'

describe('trace command', () => {
  let sigintHandlers: (() => void)[]
  let onSpy: ReturnType<typeof vi.spyOn>
  let offSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    startProxyMock.mockReset()
    stopProxyMock.mockReset()
    startProxyMock.mockResolvedValue({
      port: 12345,
      server: { close: (cb: () => void) => cb() },
      capturedBodies: [],
      captured: false,
    })
    stopProxyMock.mockResolvedValue(undefined)
    sigintHandlers = []
    // ponytail: as any — vi.spyOn generic inference narrows to overloaded signatures,
    // incompatible with the looser mockImplementation return type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSpy = vi.spyOn(process, 'on' as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    offSpy = vi.spyOn(process, 'off' as any)
    // @ts-expect-error: mockImplementation overload conflict with vi.spyOn generic inference
    onSpy.mockImplementation((event: string, listener: () => void) => {
      if (event === 'SIGINT') sigintHandlers.push(listener)
      return process
    })
    // @ts-expect-error: mockImplementation overload conflict with vi.spyOn generic inference
    offSpy.mockImplementation((event: string, listener: () => void) => {
      if (event === 'SIGINT') {
        sigintHandlers = sigintHandlers.filter((h) => h !== listener)
      }
      return process
    })
  })

  afterEach(() => {
    onSpy.mockRestore()
    offSpy.mockRestore()
  })

  it('should start proxy with traceDir and print CODEBUDDY_BASE_URL export command', async () => {
    const logs: string[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '))
    })

    const promise = trace({ port: 12345, upstream: 'http://upstream:8080' })
    // Resolve the waiting promise by simulating SIGINT
    await Promise.resolve()
    expect(sigintHandlers.length).toBe(1)
    sigintHandlers[0]()
    await promise

    expect(startProxyMock).toHaveBeenCalledWith({
      port: 12345,
      apiBaseUrl: 'http://upstream:8080',
      traceDir: '/tmp/st-trace-cmd-test/save-token-resource/trace',
    })
    expect(stopProxyMock).toHaveBeenCalled()

    const allLogs = logs.join('\n')
    expect(allLogs).toContain('http://127.0.0.1:12345')
    expect(allLogs).toContain('export CODEBUDDY_BASE_URL=http://127.0.0.1:12345/v2')
    expect(allLogs).toContain('codebuddy')

    spy.mockRestore()
  })

  it('should use undefined port when not provided', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const promise = trace({})
    await Promise.resolve()
    sigintHandlers[0]()
    await promise

    expect(startProxyMock).toHaveBeenCalledWith({
      port: undefined,
      apiBaseUrl: undefined,
      traceDir: '/tmp/st-trace-cmd-test/save-token-resource/trace',
    })

    spy.mockRestore()
  })
})
