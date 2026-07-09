import { appendFileSync } from 'node:fs'
import { format } from 'node:util'
import { ensureDir } from './fs-operations'
import { getResourceDir } from './resource-dir'
import createDebug from 'debug'

const LOG_FILE = `${getResourceDir()}/debug.log`
let _initialized = false

function ensureLogDir(): void {
  if (_initialized) return
  ensureDir(getResourceDir())
  _initialized = true
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex -- intentional ANSI escape strip
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
}

// Route all debug output to file.
// debug library passes: [fmt_with_placeholders, ...format_args, time_diff?]
// time_diff is only appended when colors are enabled (TTY). In non-TTY mode
// (e.g. piped), formatArgs prepends date to args[0] and does NOT push a suffix.
// Therefore we format ALL args via util.format (which handles %s/%d/...),
// then strip ANSI codes.
createDebug.log = (...args: unknown[]) => {
  ensureLogDir()
  const line = stripAnsi(format(...args))
  appendFileSync(LOG_FILE, line + '\n')
}

/**
 * Create a debug logger with namespace `st:<name>`.
 * Enable with ST_DEBUG=1 or DEBUG=st:*.
 * Logs are appended to save-token-resource/debug.log.
 */
export function createLogger(name: string): createDebug.Debugger {
  return createDebug(`st:${name}`)
}

// global default logger
export const logger = createLogger('main')
