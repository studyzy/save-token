import type { OptimizationSuggestion } from '../types'
import { exists, readFile, writeFile } from '../utils/fs-operations'
import { CodeBuddyAdapter } from '../adapters/codebuddy-adapter'

interface ConfigResult {
  success: boolean
  error?: string
}

/**
 * Apply a config-change suggestion to CodeBuddy config files.
 */
export async function applyConfigChange(suggestion: OptimizationSuggestion): Promise<ConfigResult> {
  const adapter = new CodeBuddyAdapter()
  const paths = adapter.getConfigPaths()
  const targetFile = suggestion.actionPayload.targetFile
    ? expandPath(suggestion.actionPayload.targetFile)
    : null

  if (!targetFile) {
    return { success: true }
  }

  switch (suggestion.actionType) {
    case 'disable_mcp':
      return disableMcp(paths.mcp, suggestion.target)
    case 'enable_mcp_defer_loading':
      return setMcpDeferLoading(paths.mcp, suggestion.target, true)
    case 'disable_plugin':
      return disablePlugin(paths.settings, suggestion.target)
    case 'disable_skill':
      return { success: true }
    case 'enable_defer_tool_loading':
      return setSettingsField(paths.settings, 'deferToolLoading', true)
    default:
      return { success: true }
  }
}

function expandPath(path: string): string {
  if (path.startsWith('~/')) {
    return `${process.env.HOME}/${path.slice(2)}`
  }
  return path
}

function disableMcp(mcpPath: string, name: string): ConfigResult {
  if (!exists(mcpPath)) return { success: false, error: 'mcp.json not found' }
  try {
    const content = readFile(mcpPath)
    const config = JSON.parse(content) as {
      mcpServers?: Record<string, unknown>
      disabledMcpServers?: string[]
    }
    if (!config.mcpServers?.[name]) {
      return { success: true }
    }
    const server = config.mcpServers[name]
    delete config.mcpServers[name]
    config.disabledMcpServers = [...(config.disabledMcpServers ?? []), name]
    writeFile(mcpPath, JSON.stringify(config, null, 2))
    void server
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function setMcpDeferLoading(mcpPath: string, name: string, value: boolean): ConfigResult {
  if (!exists(mcpPath)) return { success: false, error: 'mcp.json not found' }
  try {
    const content = readFile(mcpPath)
    const config = JSON.parse(content) as {
      mcpServers?: Record<string, { defer_loading?: boolean }>
    }
    const server = config.mcpServers?.[name]
    if (!server) return { success: false, error: `mcp ${name} not found` }
    server.defer_loading = value
    writeFile(mcpPath, JSON.stringify(config, null, 2))
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function disablePlugin(settingsPath: string, pluginId: string): ConfigResult {
  if (!exists(settingsPath)) return { success: false, error: 'settings.json not found' }
  try {
    const content = readFile(settingsPath)
    const settings = JSON.parse(content) as { enabledPlugins?: Record<string, boolean> }
    if (!settings.enabledPlugins?.[pluginId]) {
      return { success: true }
    }
    settings.enabledPlugins[pluginId] = false
    writeFile(settingsPath, JSON.stringify(settings, null, 2))
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function setSettingsField(settingsPath: string, field: string, value: unknown): ConfigResult {
  if (!exists(settingsPath)) return { success: false, error: 'settings.json not found' }
  try {
    const content = readFile(settingsPath)
    const settings = JSON.parse(content) as Record<string, unknown>
    settings[field] = value
    writeFile(settingsPath, JSON.stringify(settings, null, 2))
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
