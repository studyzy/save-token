import { ensureDir, writeJsonFile } from './fs-operations'

const RESOURCE_DIR_NAME = 'save-token-resource'

/**
 * Get the resource directory path under current working directory.
 */
export function getResourceDir(): string {
  return `${process.cwd()}/${RESOURCE_DIR_NAME}`
}

/**
 * Ensure the resource directory exists, creating it if necessary.
 * Returns the resource directory path.
 */
export function ensureResourceDir(): string {
  const dir = getResourceDir()
  ensureDir(dir)
  return dir
}

/**
 * Write JSON data to a file inside the resource directory.
 * Creates the directory if it doesn't exist.
 */
export function writeResource(filename: string, data: unknown): void {
  const dir = ensureResourceDir()
  writeJsonFile(`${dir}/${filename}`, data)
}
