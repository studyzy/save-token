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
  const alreadyInstalled = await commandExists(toolId)
  if (alreadyInstalled) {
    return {
      toolId,
      success: true,
      configChanges: [],
      installOutput: 'already installed',
    }
  }

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

interface ShellResult {
  ok: boolean
  stdout: string
  stderr: string
  error?: string
}

async function runShell(command: string): Promise<ShellResult> {
  try {
    const parts = parseShellCommand(command)
    const bin = parts[0]!
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
    return command.split('&&')[0]!.trim().split(/\s+/)
  }
  return command.trim().split(/\s+/)
}
