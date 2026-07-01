import { describe, it, expect } from 'vitest'
import { printDiagnosisReport, printSuggestions, printOptimizePreview } from '../../src/utils/output'
import type { DiagnosisReport, OptimizationSuggestion } from '../../src/types'

const sampleReport: DiagnosisReport = {
  scanTimestamp: '2026-07-01T00:00:00.000Z',
  codebuddyVersion: '2.0.0',
  platform: 'macos',
  contextOverview: { totalEstimatedTokens: 1000, breakdown: [] },
  mcpList: [],
  skillList: [],
  pluginList: [],
  hookList: [],
  configFiles: [],
  toolDetection: [],
  headlessAvailable: false,
  warnings: [],
}

const sampleSuggestion: OptimizationSuggestion = {
  id: 'test',
  type: 'install_tool',
  target: 'rtk',
  reason: 'test reason',
  estimatedSavingTokens: 1000,
  estimatedSavingPercent: 10,
  risk: 'low',
  reversible: true,
  actionType: 'install_rtk',
  actionPayload: { installCommand: 'brew install rtk' },
}

describe('output', () => {
  it('should print json format for diagnose', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printDiagnosisReport(sampleReport, 'json')
    const out = spy.mock.calls[0]![0]
    const parsed = JSON.parse(out)
    expect(parsed.scanTimestamp).toBe('2026-07-01T00:00:00.000Z')
    spy.mockRestore()
  })

  it('should print terminal format for diagnose', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printDiagnosisReport(sampleReport, 'terminal')
    expect(spy.mock.calls.length).toBeGreaterThan(0)
    spy.mockRestore()
  })

  it('should print md format for diagnose', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printDiagnosisReport(sampleReport, 'md')
    expect(spy.mock.calls[0]![0]).toContain('# CodeBuddy Token 诊断报告')
    spy.mockRestore()
  })

  it('should print suggestions json', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printSuggestions([sampleSuggestion], 1000, 10, 'json')
    const out = spy.mock.calls[0]![0]
    const parsed = JSON.parse(out)
    expect(parsed.suggestions[0].target).toBe('rtk')
    spy.mockRestore()
  })

  it('should print optimize preview', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printOptimizePreview([sampleSuggestion], true)
    expect(spy.mock.calls.some(c => c[0]?.includes('dry-run'))).toBe(true)
    spy.mockRestore()
  })

  it('should handle empty suggestions in preview', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printOptimizePreview([], true)
    expect(spy.mock.calls.some(c => c[0]?.includes('无优化建议'))).toBe(true)
    spy.mockRestore()
  })
})
