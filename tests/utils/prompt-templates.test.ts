import { describe, it, expect } from 'vitest'
import {
  MCP_LIST_PROMPT,
  SKILL_LIST_PROMPT,
  TOOL_LIST_PROMPT,
  MCP_LIST_SCHEMA,
  SKILL_LIST_SCHEMA,
  TOOL_LIST_SCHEMA,
} from '../../src/utils/prompt-templates'

describe('prompt-templates', () => {
  it('should export non-empty prompt strings', () => {
    expect(MCP_LIST_PROMPT.length).toBeGreaterThan(0)
    expect(SKILL_LIST_PROMPT.length).toBeGreaterThan(0)
    expect(TOOL_LIST_PROMPT.length).toBeGreaterThan(0)
  })

  it('should export JSON schemas', () => {
    expect(MCP_LIST_SCHEMA.type).toBe('array')
    expect(SKILL_LIST_SCHEMA.type).toBe('array')
    expect(TOOL_LIST_SCHEMA.type).toBe('array')
  })

  it('should have required fields in MCP schema', () => {
    const props = MCP_LIST_SCHEMA.items.properties
    expect(props.name).toBeDefined()
    expect(props.status).toBeDefined()
    expect(props.toolsCount).toBeDefined()
    expect(props.source).toBeDefined()
  })

  it('should have required fields in Skill schema', () => {
    const props = SKILL_LIST_SCHEMA.items.properties
    expect(props.name).toBeDefined()
    expect(props.source).toBeDefined()
    expect(props.description).toBeDefined()
  })
})
