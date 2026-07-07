import { describe, it, expect } from 'vitest'
import type { PlatformAdapter, PlatformConfigPaths } from '../../src/adapters/platform-adapter'
import { CodeBuddyAdapter } from '../../src/adapters/codebuddy-adapter'

describe('PlatformAdapter interface', () => {
  it('should have all required methods defined in CodeBuddyAdapter', () => {
    const adapter: PlatformAdapter = new CodeBuddyAdapter()

    expect(adapter.name).toBe('codebuddy')
    expect(typeof adapter.detectInstall).toBe('function')
    expect(typeof adapter.getConfigPaths).toBe('function')
    expect(typeof adapter.getHeadlessCommand).toBe('function')
    expect(typeof adapter.parseHeadlessOutput).toBe('function')
  })

  it('should return config paths with all required fields', () => {
    const adapter = new CodeBuddyAdapter()
    const paths: PlatformConfigPaths = adapter.getConfigPaths()

    expect(paths.mcp).toBeDefined()
    expect(paths.settings).toBeDefined()
    expect(paths.codebuddyMd).toBeDefined()
    expect(paths.skillsDir).toBeDefined()
    expect(paths.commandsDir).toBeDefined()
    expect(paths.rulesDir).toBeDefined()
    expect(paths.agentsDir).toBeDefined()
    expect(paths.pluginsMarketplacesDir).toBeDefined()
    expect(paths.historyFile).toBeDefined()
    expect(paths.blobsDir).toBeDefined()
    expect(paths.cliBinary).toBeDefined()
    expect(typeof paths.mcp).toBe('string')
    expect(typeof paths.settings).toBe('string')
    expect(typeof paths.cliBinary).toBe('string')
  })

  it('should build headless command with correct structure', () => {
    const adapter = new CodeBuddyAdapter()
    const args = adapter.getHeadlessCommand('test prompt', { type: 'object' })

    expect(args).toContain('-p')
    expect(args).toContain('test prompt')
    expect(args).toContain('--output-format')
    expect(args).toContain('json')
    expect(args).toContain('-y')
    expect(args).toContain('--max-turns')
    expect(args).toContain('2')
    expect(args).toContain('--json-schema')
  })

  it('should build headless command without schema', () => {
    const adapter = new CodeBuddyAdapter()
    const args = adapter.getHeadlessCommand('test prompt')

    expect(args).toContain('-p')
    expect(args).toContain('test prompt')
    expect(args).not.toContain('--json-schema')
  })

  it('should parse valid headless output', () => {
    const adapter = new CodeBuddyAdapter()
    const result = adapter.parseHeadlessOutput('{"key": "value"}')

    expect(result).toEqual({ key: 'value' })
  })

  it('should return null for invalid JSON', () => {
    const adapter = new CodeBuddyAdapter()
    const result = adapter.parseHeadlessOutput('not json')

    expect(result).toBeNull()
  })

  it('should have a detectable name', () => {
    const adapter = new CodeBuddyAdapter()
    expect(adapter.name).toBe('codebuddy')
  })
})
