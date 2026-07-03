import type { ToolId, ToolInstallResult } from '../types'
import { TOOL_SPECS } from '../analyzers/rules'
import { commandExists } from '../utils/platform'
import { exec } from 'tinyexec'

/**
 * Install a token-saving tool and run its config command if needed.
 * Steps: check not already installed → run install → verify → run config command.
 */
export async function installTool(toolId: ToolId): Promise<ToolInstallResult> {
  const spec = TOOL_SPECS[toolId]

  // ponytail is installed via codebuddy plugin, not a system binary
  if (toolId === 'ponytail') {
    const alreadyInstalled = await checkPluginInstalled('ponytail')
    if (alreadyInstalled) {
      return {
        toolId,
        success: true,
        configChanges: [],
        installOutput: 'already installed',
      }
    }
    return installPlugin(toolId, spec)
  }

  const alreadyInstalled = await commandExists(toolId)
  if (alreadyInstalled) {
    return {
      toolId,
      success: true,
      configChanges: [],
      installOutput: 'already installed',
    }
  }

  return installWithSpec(toolId, spec)
}

async function installWithSpec(
  toolId: ToolId,
  spec: { installCommand: string; verifyCommand: string; configCommand: string },
): Promise<ToolInstallResult> {
  try {
    const installRes = await runShell(spec.installCommand)
    if (!installRes.ok) {
      return {
        toolId,
        success: false,
        error: installRes.stderr || installRes.error,
        configChanges: [],
      }
    }

    const verifyRes = await runShell(spec.verifyCommand)
    if (!verifyRes.ok) {
      return {
        toolId,
        success: false,
        error: `verify failed: ${verifyRes.stderr}`,
        installOutput: installRes.stdout,
        configChanges: [],
      }
    }

    if (spec.configCommand) {
      const configRes = await runShell(spec.configCommand)
      if (!configRes.ok) {
        return {
          toolId,
          success: false,
          error: `config failed: ${configRes.stderr}`,
          installOutput: installRes.stdout,
          configChanges: [],
        }
      }
    }

    return {
      toolId,
      success: true,
      installOutput: installRes.stdout,
      configChanges: [],
    }
  } catch (error) {
    return {
      toolId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      configChanges: [],
    }
  }
}

async function installPlugin(
  toolId: ToolId,
  spec: { installCommand: string; verifyCommand: string; configCommand: string },
): Promise<ToolInstallResult> {
  try {
    const installRes = await runShell(spec.installCommand)
    if (!installRes.ok) {
      return {
        toolId,
        success: false,
        error: installRes.stderr || installRes.error,
        configChanges: [],
      }
    }

    // Plugin install may need a moment to sync
    const verifyRes = await runShell(spec.verifyCommand)
    if (!verifyRes.ok) {
      return {
        toolId,
        success: false,
        error: `verify failed: ${verifyRes.stderr}`,
        installOutput: installRes.stdout,
        configChanges: [],
      }
    }

    return {
      toolId,
      success: true,
      installOutput: installRes.stdout,
      configChanges: [],
    }
  } catch (error) {
    return {
      toolId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      configChanges: [],
    }
  }
}

async function checkPluginInstalled(pluginId: string): Promise<boolean> {
  const res = await runShell(`ls ~/.codebuddy/plugins/marketplaces/${pluginId}/`)
  return res.ok
}

interface ShellResult {
  ok: boolean
  stdout: string
  stderr: string
  error?: string
}

async function runShell(command: string): Promise<ShellResult> {
  try {
    const parts = parseShellCommand(command)
    const bin = parts[0]
    const args = parts.slice(1)
    const res = await exec(bin, args, { nodeOptions: { stdio: 'pipe' } })
    return {
      ok: res.exitCode === 0,
      stdout: res.stdout ?? '',
      stderr: res.stderr ?? '',
    }
  } catch (error) {
    return {
      ok: false,
      stdout: '',
      stderr: '',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Very small shell splitter: handles && and spaces. Does NOT handle quotes/escaping
 * beyond splitting on whitespace and the && operator.
 */
function parseShellCommand(command: string): string[] {
  if (command.includes('&&')) {
    // For chained commands we only return the first; callers should split externally.
    // In practice the install commands here are simple, so split first segment.
    return command.split('&&')[0].trim().split(/\s+/)
  }
  return command.trim().split(/\s+/)
}
