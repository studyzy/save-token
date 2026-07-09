import * as nodeFs from 'node:fs'
import { platform } from 'node:os'
import process from 'node:process'
import { dirname } from 'pathe'
import { exec } from 'tinyexec'

export type Platform = 'windows' | 'macos' | 'linux'

export function getPlatform(): Platform {
  const p = platform()
  if (p === 'win32') return 'windows'
  if (p === 'darwin') return 'macos'
  return 'linux'
}

export function isWindows(): boolean {
  return getPlatform() === 'windows'
}

export function isTermux(): boolean {
  return (
    (!!process.env.PREFIX && process.env.PREFIX.includes('com.termux')) ||
    !!process.env.TERMUX_VERSION ||
    nodeFs.existsSync('/data/data/com.termux/files/usr')
  )
}

export function getTermuxPrefix(): string {
  return process.env.PREFIX || '/data/data/com.termux/files/usr'
}

export function shouldUseSudoForGlobalInstall(): boolean {
  if (isTermux()) return false
  if (getPlatform() !== 'linux') return false
  const getuid = (process as NodeJS.Process & { getuid?: () => number }).getuid
  if (typeof getuid !== 'function') return false
  try {
    return getuid() !== 0
  } catch {
    return false
  }
}

export function wrapCommandWithSudo(
  command: string,
  args: string[],
): { command: string; args: string[]; usedSudo: boolean } {
  if (shouldUseSudoForGlobalInstall()) {
    return { command: 'sudo', args: [command, ...args], usedSudo: true }
  }
  return { command, args, usedSudo: false }
}

export async function commandExists(command: string): Promise<boolean> {
  try {
    const cmd = getPlatform() === 'windows' ? 'where' : 'which'
    const res = await exec(cmd, [command])
    if (res.exitCode === 0) return true
  } catch {
    // continue to fallback
  }
  if (isTermux()) {
    const termuxPrefix = getTermuxPrefix()
    const possiblePaths = [
      `${termuxPrefix}/bin/${command}`,
      `${termuxPrefix}/usr/bin/${command}`,
      `/data/data/com.termux/files/usr/bin/${command}`,
    ]
    for (const path of possiblePaths) {
      if (nodeFs.existsSync(path)) return true
    }
  }
  if (getPlatform() !== 'windows') {
    const commonPaths = [
      `/usr/local/bin/${command}`,
      `/usr/bin/${command}`,
      `/bin/${command}`,
      `${process.env.HOME}/.local/bin/${command}`,
    ]
    for (const path of commonPaths) {
      if (nodeFs.existsSync(path)) return true
    }
    if (getPlatform() === 'macos') {
      const homebrewPaths = [`/opt/homebrew/bin/${command}`, `/usr/local/bin/${command}`]
      for (const path of homebrewPaths) {
        if (nodeFs.existsSync(path)) return true
      }
    }
  }
  return false
}

export async function findCommandPath(command: string): Promise<string | null> {
  try {
    const cmd = getPlatform() === 'windows' ? 'where' : 'which'
    const res = await exec(cmd, [command])
    if (res.exitCode === 0 && res.stdout.trim()) {
      return res.stdout.trim().split('\n')[0].trim()
    }
  } catch {
    // ignore
  }
  return null
}

export async function getCommandVersion(command: string): Promise<string | null> {
  try {
    const res = await exec(command, ['--version'])
    if (res.exitCode === 0 && res.stdout) {
      return res.stdout.trim().split('\n')[0].trim()
    }
  } catch {
    // ignore
  }
  return null
}

export function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || '~'
}

/** Check whether a process matching the given name is running. Cross-platform. */
export async function isProcessRunning(name: string): Promise<boolean> {
  try {
    if (getPlatform() === 'windows') {
      const res = await exec('tasklist', ['/FI', `IMAGENAME eq ${name}.exe`, '/NH'])
      return res.exitCode === 0 && res.stdout.toLowerCase().includes(name.toLowerCase())
    }
    // Unix: pgrep default excludes itself; -f matches full command line.
    const res = await exec('pgrep', ['-f', name])
    return res.exitCode === 0 && res.stdout.trim().length > 0
  } catch {
    return false
  }
}

export function getCodebuddyDir(): string {
  return `${getHomeDir()}/.codebuddy`
}

export function joinPath(...segments: string[]): string {
  return segments.join('/').replace(/\/+/g, '/')
}

export { dirname }
