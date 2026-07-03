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
