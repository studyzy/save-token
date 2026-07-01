import { describe, it, expect } from 'vitest'
import { generateCodebuddyMdDiff } from '../../src/executors/diff-generator'
import type { ConfigFileSummary } from '../../src/types'

describe('diff-generator', () => {
  it('should return null when file does not exist', () => {
    const summary: ConfigFileSummary = {
      path: '/nonexistent/CODEBUDDY.md',
      exists: false,
      sizeBytes: 0,
      lineCount: 0,
      estimatedTokens: 0,
      impactLevel: 'low',
    }
    expect(generateCodebuddyMdDiff(summary)).toBeNull()
  })

  it('should generate diff header when file exists', () => {
    const summary: ConfigFileSummary = {
      path: '/home/.codebuddy/CODEBUDDY.md',
      exists: true,
      sizeBytes: 10000,
      lineCount: 300,
      estimatedTokens: 2500,
      impactLevel: 'high',
    }
    const diff = generateCodebuddyMdDiff(summary)
    expect(diff).not.toBeNull()
    expect(diff).toContain('--- before')
    expect(diff).toContain('+++ after')
    expect(diff).toContain('300 lines')
  })
})
