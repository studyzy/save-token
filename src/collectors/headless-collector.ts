import type { PlatformAdapter } from '../adapters/platform-adapter'
import { exec } from 'tinyexec'

export interface HeadlessProbeResult {
  ok: boolean
  stdout: string
  stderr: string
  exitCode: number
  parsed: unknown
  error?: string
}

const DEFAULT_TIMEOUT_MS = 60_000

/**
 * Call `codebuddy -p "<prompt>"` (or platform equivalent) to self-report data.
 * On failure (binary missing / timeout / non-zero exit) returns ok=false.
 */
export async function probe(
  adapter: PlatformAdapter,
  prompt: string,
  schema?: object,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<HeadlessProbeResult> {
  const binary = adapter.getConfigPaths().cliBinary
  const args = adapter.getHeadlessCommand(prompt, schema)

  try {
    const result = await exec(binary, args, { timeout: timeoutMs })
    const stdout = result.stdout ?? ''
    const stderr = result.stderr ?? ''
    if (result.exitCode !== 0) {
      return {
        ok: false,
        stdout,
        stderr,
        exitCode: result.exitCode ?? -1,
        parsed: null,
        error: `exit code ${result.exitCode}`,
      }
    }
    const parsed = adapter.parseHeadlessOutput(stdout)
    return {
      ok: parsed !== null,
      stdout,
      stderr,
      exitCode: result.exitCode ?? 0,
      parsed,
    }
  } catch (error) {
    return {
      ok: false,
      stdout: '',
      stderr: String(error),
      exitCode: -1,
      parsed: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Run multiple probes in parallel and collect results.
 */
export async function probeAll(
  adapter: PlatformAdapter,
  probes: Array<{ prompt: string; schema?: object; key: string }>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Record<string, HeadlessProbeResult>> {
  const entries = await Promise.all(
    probes.map(async (p) => [
      p.key,
      await probe(adapter, p.prompt, p.schema, timeoutMs),
    ] satisfies [string, HeadlessProbeResult]),
  )
  return Object.fromEntries(entries)
}
