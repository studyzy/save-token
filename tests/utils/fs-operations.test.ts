import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  exists,
  ensureDir,
  writeFile,
  readFile,
  copyFile,
  readDir,
  removeFile,
  readJsonFile,
  writeJsonFile,
  FileSystemError,
} from '../../src/utils/fs-operations'

const TMP = '/tmp/st-fs-test'

describe('fs-operations', () => {
  beforeEach(() => {
    ensureDir(TMP)
  })

  afterEach(() => {
    // Best-effort cleanup
    try {
      removeFile(`${TMP}/test.txt`)
      removeFile(`${TMP}/test.json`)
      removeFile(`${TMP}/copy.txt`)
      removeFile(`${TMP}/sub/nested.txt`)
      removeFile(`${TMP}/sub`)
      removeFile(TMP)
    } catch {
      // ignore
    }
  })

  it('exists should return false for missing path', () => {
    expect(exists('/nonexistent/path/xyz')).toBe(false)
  })

  it('writeFile + readFile roundtrip', () => {
    writeFile(`${TMP}/test.txt`, 'hello')
    expect(readFile(`${TMP}/test.txt`)).toBe('hello')
  })

  it('ensureDir should create nested dirs', () => {
    ensureDir(`${TMP}/nested/deep/dir`)
    expect(exists(`${TMP}/nested/deep/dir`)).toBe(true)
  })

  it('copyFile should copy content', () => {
    writeFile(`${TMP}/test.txt`, 'content')
    copyFile(`${TMP}/test.txt`, `${TMP}/copy.txt`)
    expect(readFile(`${TMP}/copy.txt`)).toBe('content')
  })

  it('readJsonFile should parse JSON', () => {
    writeFile(`${TMP}/test.json`, '{"key":"value"}')
    expect(readJsonFile(`${TMP}/test.json`)).toEqual({ key: 'value' })
  })

  it('readJsonFile should return null for missing file', () => {
    expect(readJsonFile(`${TMP}/missing.json`)).toBeNull()
  })

  it('readJsonFile should return null for invalid JSON', () => {
    writeFile(`${TMP}/test.json`, 'not json')
    expect(readJsonFile(`${TMP}/test.json`)).toBeNull()
  })

  it('writeJsonFile should write formatted JSON', () => {
    writeJsonFile(`${TMP}/test.json`, { a: 1 })
    const content = readFile(`${TMP}/test.json`)
    expect(content).toContain('"a": 1')
  })

  it('readDir should list entries', () => {
    writeFile(`${TMP}/a.txt`, 'a')
    writeFile(`${TMP}/b.txt`, 'b')
    const entries = readDir(TMP)
    expect(entries).toContain('a.txt')
    expect(entries).toContain('b.txt')
  })

  it('FileSystemError should preserve properties', () => {
    const cause = new Error('cause')
    const err = new FileSystemError('msg', '/path', cause)
    expect(err.message).toBe('msg')
    expect(err.path).toBe('/path')
    expect(err.cause).toBe(cause)
    expect(err.name).toBe('FileSystemError')
  })
})
