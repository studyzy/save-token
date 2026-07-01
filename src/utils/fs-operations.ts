import type { Stats } from 'node:fs'
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname } from 'pathe'

/**
 * Unified file system operations with error handling.
 * Mirrors zcf's fs-operations.ts pattern.
 */
export class FileSystemError extends Error {
  constructor(
    message: string,
    public readonly path?: string,
    public readonly cause?: Error,
  ) {
    super(message)
    this.name = 'FileSystemError'
  }
}

export function exists(path: string): boolean {
  return existsSync(path)
}

export function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
  }
}

export function ensureFileDir(filePath: string): void {
  const dir = dirname(filePath)
  ensureDir(dir)
}

export function readFile(path: string, encoding: BufferEncoding = 'utf-8'): string {
  try {
    return readFileSync(path, encoding)
  } catch (error) {
    throw new FileSystemError(`Failed to read file: ${path}`, path, error as Error)
  }
}

export function writeFile(path: string, content: string, encoding: BufferEncoding = 'utf-8'): void {
  try {
    ensureFileDir(path)
    writeFileSync(path, content, encoding)
  } catch (error) {
    throw new FileSystemError(`Failed to write file: ${path}`, path, error as Error)
  }
}

export function copyFile(src: string, dest: string): void {
  try {
    ensureFileDir(dest)
    copyFileSync(src, dest)
  } catch (error) {
    throw new FileSystemError(`Failed to copy file from ${src} to ${dest}`, src, error as Error)
  }
}

export function readDir(path: string): string[] {
  try {
    return readdirSync(path)
  } catch (error) {
    throw new FileSystemError(`Failed to read directory: ${path}`, path, error as Error)
  }
}

export function getStats(path: string): Stats {
  try {
    return statSync(path)
  } catch (error) {
    throw new FileSystemError(`Failed to get stats for: ${path}`, path, error as Error)
  }
}

export function isDirectory(path: string): boolean {
  try {
    return getStats(path).isDirectory()
  } catch {
    return false
  }
}

export function isFile(path: string): boolean {
  try {
    return getStats(path).isFile()
  } catch {
    return false
  }
}

export function removeFile(path: string): void {
  try {
    if (exists(path)) {
      unlinkSync(path)
    }
  } catch (error) {
    throw new FileSystemError(`Failed to remove file: ${path}`, path, error as Error)
  }
}

export function copyDir(src: string, dest: string, options: { overwrite?: boolean } = {}): void {
  const { overwrite = true } = options
  if (!exists(src)) {
    throw new FileSystemError(`Source directory does not exist: ${src}`, src)
  }
  ensureDir(dest)
  const entries = readDir(src)
  for (const entry of entries) {
    const srcPath = `${src}/${entry}`
    const destPath = `${dest}/${entry}`
    let stats: Stats
    try {
      stats = lstatSync(srcPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    if (stats.isSymbolicLink()) {
      try {
        existsSync(srcPath)
        const targetStats = statSync(srcPath)
        if (targetStats.isDirectory()) {
          copyDir(srcPath, destPath, options)
        } else {
          if (!overwrite && exists(destPath)) continue
          copyFile(srcPath, destPath)
        }
      } catch {
        continue
      }
      continue
    }
    if (stats.isDirectory()) {
      copyDir(srcPath, destPath, options)
    } else {
      if (!overwrite && exists(destPath)) continue
      copyFile(srcPath, destPath)
    }
  }
}

export function remove(path: string): void {
  try {
    if (!exists(path)) return
    rmSync(path, { recursive: true, force: true })
  } catch (error) {
    throw new FileSystemError(`Failed to remove: ${path}`, path, error as Error)
  }
}

export function readJsonFile<T>(path: string): T | null {
  if (!exists(path)) return null
  try {
    const content = readFile(path)
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

export function writeJsonFile(path: string, data: unknown): void {
  const content = JSON.stringify(data, null, 2)
  writeFile(path, content)
}
