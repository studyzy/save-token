import { describe, it, expect } from 'vitest'
import { estimate, estimateFile, estimateMcpTokens, impactLevel, TOKENS_PER_MCP_TOOL } from '../../src/collectors/token-estimator'

describe('token-estimator', () => {
  describe('estimate', () => {
    it('should return 0 for empty string', () => {
      expect(estimate('')).toBe(0)
    })

    it('should return ceil(length/4) for non-empty', () => {
      expect(estimate('hello')).toBe(2) // 5/4=1.25 -> 2
      expect(estimate('hello world!')).toBe(3) // 12/4=3
    })

    it('should handle unicode', () => {
      expect(estimate('你好')).toBe(1) // 2 chars / 4 = 0.5 -> 1
    })
  })

  describe('estimateFile', () => {
    it('should return 0 for null content', () => {
      expect(estimateFile(null)).toBe(0)
    })

    it('should estimate from content', () => {
      expect(estimateFile('hello world')).toBe(3)
    })
  })

  describe('estimateMcpTokens', () => {
    it('should use toolsCount when available', () => {
      expect(estimateMcpTokens(5, 1000)).toBe(5 * TOKENS_PER_MCP_TOOL)
    })

    it('should fall back to config size when toolsCount is null', () => {
      expect(estimateMcpTokens(null, 400)).toBe(100)
    })

    it('should fall back to config size when toolsCount is 0', () => {
      expect(estimateMcpTokens(0, 400)).toBe(100)
    })
  })

  describe('impactLevel', () => {
    it('should return low for < 1KB', () => {
      expect(impactLevel(500)).toBe('low')
      expect(impactLevel(1023)).toBe('low')
    })

    it('should return medium for 1KB-5KB', () => {
      expect(impactLevel(1024)).toBe('medium')
      expect(impactLevel(5119)).toBe('medium')
    })

    it('should return high for >= 5KB', () => {
      expect(impactLevel(5120)).toBe('high')
      expect(impactLevel(10000)).toBe('high')
    })
  })
})
