import { describe, it, expect } from 'vitest'
import { TOOL_SAVINGS, TOOL_REASONS, THRESHOLDS } from '../../src/analyzers/rules'
import { getAllTools } from '../../src/tools'

describe('rules', () => {
  it('should define specs for all 6 tools', () => {
    const tools = getAllTools()
    expect(tools).toHaveLength(6)
    const names = new Set(tools.map((t) => t.name))
    expect(names.has('rtk')).toBe(true)
    expect(names.has('caveman')).toBe(true)
    expect(names.has('headroom')).toBe(true)
    expect(names.has('lean-ctx')).toBe(true)
    expect(names.has('graphify')).toBe(true)
    expect(names.has('ponytail')).toBe(true)
  })

  it('should have install commands', () => {
    for (const tool of getAllTools()) {
      expect(tool.installCommand.length).toBeGreaterThan(0)
    }
  })

  it('should have verify commands', () => {
    for (const tool of getAllTools()) {
      expect(tool.verifyCommand.length).toBeGreaterThan(0)
    }
  })

  it('should have savings numbers for all tools', () => {
    expect(Object.keys(TOOL_SAVINGS)).toHaveLength(6)
    expect(TOOL_SAVINGS.rtk).toBeGreaterThan(0)
  })

  it('should have reasons for all tools', () => {
    expect(Object.keys(TOOL_REASONS)).toHaveLength(6)
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
