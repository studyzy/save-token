import { describe, it, expect } from 'vitest'
import { generateSuggestions } from '../../src/analyzers/suggestion-engine'
import type { DiagnosisReport, McpEntry, SkillEntry, PluginEntry, ToolDetection } from '../../src/types'

function makeReport(overrides: Partial<DiagnosisReport> = {}): DiagnosisReport {
  return {
    scanTimestamp: '2026-07-01T00:00:00.000Z',
    codebuddyVersion: '2.114.1',
    platform: 'macos',
    contextOverview: { totalEstimatedTokens: 10000, breakdown: [] },
    mcpList: [],
    skillList: [],
    pluginList: [],
    hookList: [],
    configFiles: [],
    toolDetection: [],
    headlessAvailable: false,
    warnings: [],
    ...overrides,
  }
}

const notInstalledTools: ToolDetection[] = [
  { name: 'rtk', installed: false, version: null, installPath: null, codebuddyIntegrated: false, recommendedSaving: '89%' },
  { name: 'caveman', installed: false, version: null, installPath: null, codebuddyIntegrated: false, recommendedSaving: '70%' },
  { name: 'headroom', installed: false, version: null, installPath: null, codebuddyIntegrated: false, recommendedSaving: '70%' },
  { name: 'lean-ctx', installed: false, version: null, installPath: null, codebuddyIntegrated: false, recommendedSaving: '75%' },
  { name: 'graphify', installed: false, version: null, installPath: null, codebuddyIntegrated: false, recommendedSaving: '71x' },
]

describe('suggestion-engine', () => {
  it('should suggest installing uninstalled tools', () => {
    const report = makeReport({ toolDetection: notInstalledTools })
    const suggestions = generateSuggestions(report)
    const installSuggestions = suggestions.filter(s => s.type === 'install_tool')
    expect(installSuggestions.length).toBe(5)
    const rtkSuggestion = suggestions.find(s => s.target === 'rtk')
    expect(rtkSuggestion).toBeDefined()
    expect(rtkSuggestion!.estimatedSavingTokens).toBe(8900)
  })

  it('should not suggest installed tools', () => {
    const installed: ToolDetection[] = notInstalledTools.map(t => ({ ...t, installed: true, codebuddyIntegrated: true }))
    const report = makeReport({ toolDetection: installed })
    const suggestions = generateSuggestions(report)
    expect(suggestions.filter(s => s.type === 'install_tool')).toHaveLength(0)
  })

  it('should suggest disabling MCP with CLI alternative', () => {
    const mcp: McpEntry = {
      name: 'Playwright',
      status: 'enabled',
      type: 'stdio',
      toolsCount: 8,
      deferLoading: false,
      source: 'user',
      estimatedTokens: 1600,
      hasCliAlternative: true,
      cliAlternative: 'playwright',
    }
    const report = makeReport({ mcpList: [mcp] })
    const suggestions = generateSuggestions(report)
    const disableSuggestion = suggestions.find(s => s.actionType === 'disable_mcp')
    expect(disableSuggestion).toBeDefined()
    expect(disableSuggestion!.target).toBe('Playwright')
  })

  it('should suggest defer_loading for large MCP without it', () => {
    const mcp: McpEntry = {
      name: 'serena',
      status: 'enabled',
      type: 'stdio',
      toolsCount: 12,
      deferLoading: false,
      source: 'user',
      estimatedTokens: 2400,
      hasCliAlternative: false,
    }
    const report = makeReport({ mcpList: [mcp] })
    const suggestions = generateSuggestions(report)
    const defer = suggestions.find(s => s.actionType === 'enable_mcp_defer_loading')
    expect(defer).toBeDefined()
    expect(defer!.target).toBe('serena')
  })

  it('should suggest disabling low-frequency plugins', () => {
    const plugin: PluginEntry = {
      id: 'pptx@codebuddy-plugins-official',
      pluginId: 'pptx',
      marketplace: 'codebuddy-plugins-official',
      enabled: true,
      installedPath: null,
      isLowFrequency: true,
    }
    const report = makeReport({ pluginList: [plugin] })
    const suggestions = generateSuggestions(report)
    const disable = suggestions.find(s => s.actionType === 'disable_plugin')
    expect(disable).toBeDefined()
    expect(disable!.target).toBe('pptx@codebuddy-plugins-official')
  })

  it('should warn when skills count > 10', () => {
    const skills: SkillEntry[] = Array.from({ length: 15 }, (_, i) => ({
      name: `skill-${i}`,
      source: 'user' as const,
      sourcePath: `/skills/skill-${i}/SKILL.md`,
      description: 'test',
      fileSizeBytes: 100,
      estimatedTokens: 100,
      loaded: null,
    }))
    const report = makeReport({ skillList: skills })
    const suggestions = generateSuggestions(report)
    expect(suggestions.find(s => s.id === 'skill-count-warning')).toBeDefined()
  })

  it('should sort suggestions by estimatedSavingTokens desc', () => {
    const report = makeReport({ toolDetection: notInstalledTools })
    const suggestions = generateSuggestions(report)
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i]!.estimatedSavingTokens).toBeLessThanOrEqual(
        suggestions[i - 1]!.estimatedSavingTokens,
      )
    }
  })
})
