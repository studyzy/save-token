import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scanFilesystem } from '../../src/collectors/fs-collector'
import type { PlatformAdapter, PlatformConfigPaths } from '../../src/adapters/platform-adapter'

vi.mock('tinyexec', () => ({ exec: vi.fn() }))

const FIXTURES = `${__dirname}/../fixtures`

function makeAdapter(root: string): PlatformAdapter {
  return {
    name: 'test',
    async detectInstall() {
      return true
    },
    getConfigPaths(): PlatformConfigPaths {
      return {
        mcp: `${root}/mcp.json`,
        settings: `${root}/settings.json`,
        codebuddyMd: `${root}/CODEBUDDY.md`,
        skillsDir: `${root}/skills`,
        commandsDir: `${root}/commands`,
        rulesDir: `${root}/rules`,
        agentsDir: `${root}/agents`,
        pluginsMarketplacesDir: `${root}/plugins/marketplaces`,
        historyFile: `${root}/history.jsonl`,
        blobsDir: `${root}/blobs`,
        cliBinary: 'codebuddy',
      }
    },
    getHeadlessCommand() {
      return []
    },
    parseHeadlessOutput() {
      return null
    },
  }
}

describe('fs-collector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should parse MCP config', () => {
    const adapter = makeAdapter(FIXTURES)
    const result = scanFilesystem(adapter)
    expect(result.mcpList.length).toBe(3)
    const headroom = result.mcpList.find(m => m.name === 'headroom')
    expect(headroom).toBeDefined()
    expect(headroom!.status).toBe('enabled')
    expect(headroom!.type).toBe('stdio')
    expect(headroom!.command).toBe('headroom')
  })

  it('should detect CLI alternatives', () => {
    const adapter = makeAdapter(FIXTURES)
    const result = scanFilesystem(adapter)
    const playwright = result.mcpList.find(m => m.name === 'Playwright')
    expect(playwright).toBeDefined()
    expect(playwright!.hasCliAlternative).toBe(true)
    expect(playwright!.cliAlternative).toBe('playwright')
  })

  it('should parse enabled plugins from settings', () => {
    const adapter = makeAdapter(FIXTURES)
    const result = scanFilesystem(adapter)
    expect(result.pluginList.length).toBe(5)
    const caveman = result.pluginList.find(p => p.id === 'caveman@caveman')
    expect(caveman).toBeDefined()
    expect(caveman!.enabled).toBe(true)
  })

  it('should flag low-frequency plugins', () => {
    const adapter = makeAdapter(FIXTURES)
    const result = scanFilesystem(adapter)
    const pptx = result.pluginList.find(p => p.id === 'pptx@codebuddy-plugins-official')
    expect(pptx).toBeDefined()
    expect(pptx!.isLowFrequency).toBe(true)
  })

  it('should parse hooks', () => {
    const adapter = makeAdapter(FIXTURES)
    const result = scanFilesystem(adapter)
    expect(result.hookList.length).toBe(2)
    const bashHook = result.hookList.find(h => h.matcher === 'Bash')
    expect(bashHook).toBeDefined()
    expect(bashHook!.command).toBe('rtk hook codebuddy')
  })

  it('should summarize config files', () => {
    const adapter = makeAdapter(FIXTURES)
    const result = scanFilesystem(adapter)
    const mcpFile = result.configFiles.find(c => c.path.endsWith('mcp.json'))
    expect(mcpFile).toBeDefined()
    expect(mcpFile!.exists).toBe(true)
    expect(mcpFile!.sizeBytes).toBeGreaterThan(0)
    expect(mcpFile!.estimatedTokens).toBeGreaterThan(0)
  })

  it('should handle missing directory gracefully', () => {
    const adapter = makeAdapter('/nonexistent/path')
    const result = scanFilesystem(adapter)
    expect(result.mcpList).toEqual([])
    expect(result.pluginList).toEqual([])
    expect(result.hookList).toEqual([])
  })
})
