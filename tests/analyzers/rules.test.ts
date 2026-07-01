import { describe, it, expect } from 'vitest'
import {
  TOOL_SPECS,
  TOOL_SAVINGS,
  TOOL_REASONS,
  THRESHOLDS,
} from '../../src/analyzers/rules'

describe('rules', () => {
  it('should define specs for all 5 tools', () => {
    expect(Object.keys(TOOL_SPECS)).toHaveLength(5)
    expect(TOOL_SPECS.rtk).toBeDefined()
    expect(TOOL_SPECS.caveman).toBeDefined()
    expect(TOOL_SPECS.headroom).toBeDefined()
    expect(TOOL_SPECS['lean-ctx']).toBeDefined()
    expect(TOOL_SPECS.graphify).toBeDefined()
  })

  it('should have install commands', () => {
    for (const id of Object.keys(TOOL_SPECS) as Array<keyof typeof TOOL_SPECS>) {
      expect(TOOL_SPECS[id].installCommand.length).toBeGreaterThan(0)
    }
  })

  it('should have verify commands', () => {
    for (const id of Object.keys(TOOL_SPECS) as Array<keyof typeof TOOL_SPECS>) {
      expect(TOOL_SPECS[id].verifyCommand.length).toBeGreaterThan(0)
    }
  })

  it('should have savings numbers for all tools', () => {
    expect(Object.keys(TOOL_SAVINGS)).toHaveLength(5)
    expect(TOOL_SAVINGS.rtk).toBeGreaterThan(0)
  })

  it('should have reasons for all tools', () => {
    expect(Object.keys(TOOL_REASONS)).toHaveLength(5)
    for (const id of Object.keys(TOOL_REASONS) as Array<keyof typeof TOOL_REASONS>) {
      expect(TOOL_REASONS[id].length).toBeGreaterThan(0)
    }
  })

  it('should define thresholds', () => {
    expect(THRESHOLDS.MCP_COUNT_WARN).toBe(5)
    expect(THRESHOLDS.SKILL_COUNT_WARN).toBe(10)
    expect(THRESHOLDS.CODEBUDDY_MD_LINES_WARN).toBe(200)
    expect(THRESHOLDS.MCP_DEFER_TOOLS_THRESHOLD).toBe(3)
  })
})
