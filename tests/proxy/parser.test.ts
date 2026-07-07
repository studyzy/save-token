import { describe, it, expect } from 'vitest'
import { parseProxyBody } from '../../src/proxy/parser'
import { readFile } from '../../src/utils/fs-operations'

describe('proxy parser', () => {
  it('should parse a real proxy request body', () => {
    const body: unknown = JSON.parse(readFile(`${__dirname}/../fixtures/proxy-request.json`))
    const result = parseProxyBody(body)

    // Messages by role
    expect(result.messagesByRole['system']).toBeDefined()
    expect(result.messagesByRole['system'].count).toBe(1)
    expect(result.messagesByRole['system'].estimatedTokens).toBeGreaterThan(0)

    expect(result.messagesByRole['user']).toBeDefined()
    expect(result.messagesByRole['user'].count).toBe(1)

    // Tool definitions
    expect(result.toolDefinitions.length).toBe(3)
    expect(result.toolDefinitions.map((t) => t.name)).toContain('read_file')
    expect(result.toolDefinitions.map((t) => t.name)).toContain('write_file')
    expect(result.toolDefinitions.map((t) => t.name)).toContain('search_code')

    // Skill references
    expect(result.skillReferences).toContain('brainstorming')
    expect(result.skillReferences).toContain('commit')

    // System prompt tokens
    expect(result.systemPromptTokens).toBeGreaterThan(0)

    // Total
    expect(result.totalEstimatedTokens).toBeGreaterThan(0)
  })

  it('should handle empty body', () => {
    const result = parseProxyBody({})

    expect(result.messagesByRole).toEqual({})
    expect(result.toolDefinitions).toEqual([])
    expect(result.skillReferences).toEqual([])
    expect(result.totalEstimatedTokens).toBe(0)
    expect(result.systemPromptTokens).toBe(0)
  })

  it('should handle messages without role', () => {
    const body = {
      messages: [{ content: 'test' }],
    }
    const result = parseProxyBody(body)

    expect(result.messagesByRole['unknown']).toBeDefined()
    expect(result.messagesByRole['unknown'].count).toBe(1)
  })

  it('should extract tool definitions without function wrapper', () => {
    const body = {
      messages: [],
      tools: [{ name: 'simple_tool', description: 'A simple tool' }],
    }
    const result = parseProxyBody(body)

    expect(result.toolDefinitions.length).toBe(1)
    expect(result.toolDefinitions[0].name).toBe('simple_tool')
  })

  it('should handle memory tokens in user messages', () => {
    const body = {
      messages: [
        {
          role: 'user',
          content:
            '<system-reminder data-role="memory">Some memory content</system-reminder>\nHello',
        },
      ],
    }
    const result = parseProxyBody(body)

    expect(result.memoryTokens).toBeGreaterThan(0)
  })
})

describe('proxy parser — MCP tools in top-level tools[] (proxy-raw-body-mcp.json)', () => {
  const fixturePath = `${__dirname}/../fixtures/proxy-raw-body-mcp.json`

  // 3 MCP tools in top-level (full schema) + 1 bare name mcp__headroom in ToolSearch deferred
  it('should classify MCP tools from top-level tools[]', () => {
    const body: unknown = JSON.parse(readFile(fixturePath))
    const result = parseProxyBody(body)

    const mcpTools = result.toolDefinitions.filter((t) => t.category === 'mcp')
    expect(mcpTools.length).toBe(3)
    expect(mcpTools.map((t) => t.name)).toEqual([
      'mcp__headroom__headroom_compress',
      'mcp__headroom__headroom_retrieve',
      'mcp__headroom__headroom_stats',
    ])

    // Each MCP tool should have meaningful token estimates (full JSON schema)
    for (const t of mcpTools) {
      expect(t.estimatedTokens).toBeGreaterThan(50)
    }
  })

  it('should track bare mcp__headroom as MCP reference', () => {
    const body: unknown = JSON.parse(readFile(fixturePath))
    const result = parseProxyBody(body)

    expect(result.mcpReferences).toContain('mcp__headroom')
  })

  it('should have correct builtin/MCP counts', () => {
    const body: unknown = JSON.parse(readFile(fixturePath))
    const result = parseProxyBody(body)

    // 22 builtin tools + 3 MCP tools = 25 total
    expect(result.builtinToolCount).toBe(22)
    expect(result.mcpToolCount).toBe(3)
    expect(result.toolDefinitions.length).toBe(25)
  })
})

describe('proxy parser — MCP tools only in ToolSearch deferred (proxy-raw-body-defer-mcp.json)', () => {
  const fixturePath = `${__dirname}/../fixtures/proxy-raw-body-defer-mcp.json`

  // 0 MCP in top-level, 4 bare names in ToolSearch deferred
  it('should have zero MCP tools in toolDefinitions', () => {
    const body: unknown = JSON.parse(readFile(fixturePath))
    const result = parseProxyBody(body)

    const mcpTools = result.toolDefinitions.filter((t) => t.category === 'mcp')
    expect(mcpTools.length).toBe(0)
    expect(result.mcpToolCount).toBe(0)
  })

  it('should track all deferred MCP names as references', () => {
    const body: unknown = JSON.parse(readFile(fixturePath))
    const result = parseProxyBody(body)

    expect(result.mcpReferences.length).toBe(4)
    expect(result.mcpReferences).toContain('mcp__headroom')
    expect(result.mcpReferences).toContain('mcp__headroom__headroom_compress')
    expect(result.mcpReferences).toContain('mcp__headroom__headroom_retrieve')
    expect(result.mcpReferences).toContain('mcp__headroom__headroom_stats')
  })

  it('should have all tools as builtin', () => {
    const body: unknown = JSON.parse(readFile(fixturePath))
    const result = parseProxyBody(body)

    expect(result.builtinToolCount).toBe(22)
    expect(result.toolDefinitions.length).toBe(22)
  })
})
