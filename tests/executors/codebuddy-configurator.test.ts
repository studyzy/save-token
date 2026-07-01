import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { applyConfigChange } from '../../src/executors/codebuddy-configurator'
import { exists, readFile, writeFile, removeFile, ensureDir, readDir } from '../../src/utils/fs-operations'
import type { OptimizationSuggestion } from '../../src/types'

const TMP = '/tmp/st-test-config'

vi.mock('tinyexec', () => ({ exec: vi.fn() }))
vi.mock('../../src/utils/platform', () => ({
  getHomeDir: vi.fn(() => TMP),
  getCodebuddyDir: vi.fn(() => `${TMP}/.codebuddy`),
  commandExists: vi.fn(),
  getPlatform: vi.fn(() => 'macos'),
  isWindows: vi.fn(() => false),
}))

describe('codebuddy-configurator', () => {
  beforeEach(() => {
    process.env.HOME = TMP
    const cbDir = `${TMP}/.codebuddy`
    ensureDir(cbDir)
    writeFile(
      `${cbDir}/.mcp.json`,
      JSON.stringify({
        mcpServers: {
          headroom: { type: 'stdio', command: 'headroom' },
          serena: { type: 'stdio', command: 'serena' },
        },
        disabledMcpServers: [],
      }),
    )
    writeFile(
      `${cbDir}/settings.json`,
      JSON.stringify({
        enabledPlugins: { 'pptx@codebuddy-plugins-official': true },
        deferToolLoading: false,
      }),
    )
  })

  afterEach(() => {
    const cbDir = `${TMP}/.codebuddy`
    if (exists(cbDir)) {
      for (const f of readDir(cbDir)) {
        removeFile(`${cbDir}/${f}`)
      }
    }
  })

  it('should disable MCP by moving to disabledMcpServers', async () => {
    const suggestion: OptimizationSuggestion = {
      id: 'test',
      type: 'config_change',
      target: 'headroom',
      reason: '',
      estimatedSavingTokens: 0,
      estimatedSavingPercent: 0,
      risk: 'low',
      reversible: true,
      actionType: 'disable_mcp',
      actionPayload: { targetFile: '~/.codebuddy/.mcp.json', operation: 'move-to-disabled' },
    }
    const result = await applyConfigChange(suggestion)
    expect(result.success).toBe(true)
    const config = JSON.parse(readFile(`${TMP}/.codebuddy/.mcp.json`))
    expect(config.mcpServers.headroom).toBeUndefined()
    expect(config.disabledMcpServers).toContain('headroom')
  })

  it('should enable defer_loading on MCP', async () => {
    const suggestion: OptimizationSuggestion = {
      id: 'test',
      type: 'config_change',
      target: 'serena',
      reason: '',
      estimatedSavingTokens: 0,
      estimatedSavingPercent: 0,
      risk: 'low',
      reversible: true,
      actionType: 'enable_mcp_defer_loading',
      actionPayload: {
        targetFile: '~/.codebuddy/.mcp.json',
        operation: 'set-field',
        fieldName: 'defer_loading',
        fieldValue: true,
      },
    }
    const result = await applyConfigChange(suggestion)
    expect(result.success).toBe(true)
    const config = JSON.parse(readFile(`${TMP}/.codebuddy/.mcp.json`))
    expect(config.mcpServers.serena.defer_loading).toBe(true)
  })

  it('should disable plugin', async () => {
    const suggestion: OptimizationSuggestion = {
      id: 'test',
      type: 'config_change',
      target: 'pptx@codebuddy-plugins-official',
      reason: '',
      estimatedSavingTokens: 0,
      estimatedSavingPercent: 0,
      risk: 'low',
      reversible: true,
      actionType: 'disable_plugin',
      actionPayload: { targetFile: '~/.codebuddy/settings.json', operation: 'set-field' },
    }
    const result = await applyConfigChange(suggestion)
    expect(result.success).toBe(true)
    const settings = JSON.parse(readFile(`${TMP}/.codebuddy/settings.json`))
    expect(settings.enabledPlugins['pptx@codebuddy-plugins-official']).toBe(false)
  })

  it('should enable deferToolLoading', async () => {
    const suggestion: OptimizationSuggestion = {
      id: 'test',
      type: 'config_change',
      target: 'deferToolLoading',
      reason: '',
      estimatedSavingTokens: 0,
      estimatedSavingPercent: 0,
      risk: 'low',
      reversible: true,
      actionType: 'enable_defer_tool_loading',
      actionPayload: { targetFile: '~/.codebuddy/settings.json', operation: 'set-field' },
    }
    const result = await applyConfigChange(suggestion)
    expect(result.success).toBe(true)
    const settings = JSON.parse(readFile(`${TMP}/.codebuddy/settings.json`))
    expect(settings.deferToolLoading).toBe(true)
  })

  it('should return success true for unknown actionType', async () => {
    const suggestion: OptimizationSuggestion = {
      id: 'test',
      type: 'config_change',
      target: 'unknown',
      reason: '',
      estimatedSavingTokens: 0,
      estimatedSavingPercent: 0,
      risk: 'low',
      reversible: true,
      actionType: 'simplify_codebuddy_md',
      actionPayload: {},
    }
    const result = await applyConfigChange(suggestion)
    expect(result.success).toBe(true)
  })
})
