import fs from 'node:fs'
import path from 'node:path'
import type { ProjectProfile } from '../types'

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.rb',
  '.c',
  '.cpp',
  '.h',
  '.vue',
  '.svelte',
  '.swift',
  '.kt',
])

const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.rst', '.txt', '.adoc', '.wiki'])

const EXCLUDE_DIRS = new Set(['node_modules', '.git', '.codebuddy'])

const MAX_DEPTH = 3

/**
 * Scan current working directory to build a ProjectProfile.
 * Counts code files and doc files, excludes node_modules/.git/.codebuddy.
 */
export function scanProjectProfile(): ProjectProfile {
  let codeFileCount = 0
  let docFileCount = 0

  function walk(dir: string, depth: number) {
    if (depth > MAX_DEPTH) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDE_DIRS.has(entry.name)) continue
        walk(path.join(dir, entry.name), depth + 1)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (CODE_EXTENSIONS.has(ext)) codeFileCount++
        else if (DOC_EXTENSIONS.has(ext)) docFileCount++
      }
    }
  }

  walk(process.cwd(), 0)

  return {
    codeFileCount,
    docFileCount,
    isLargeCodebase: codeFileCount > 100,
    hasLargeDocs: docFileCount > 50,
  }
}
