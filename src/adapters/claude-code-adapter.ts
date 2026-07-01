import type { PlatformAdapter, PlatformConfigPaths } from './platform-adapter'

/**
 * Stub adapter for Claude Code. Not implemented in v0.1.
 */
export class ClaudeCodeAdapter implements PlatformAdapter {
  readonly name = 'claude-code'

  async detectInstall(): Promise<boolean> {
    throw new Error('ClaudeCodeAdapter not implemented')
  }
  getConfigPaths(): PlatformConfigPaths {
    throw new Error('ClaudeCodeAdapter not implemented')
  }
  getHeadlessCommand(): string[] {
    throw new Error('ClaudeCodeAdapter not implemented')
  }
  parseHeadlessOutput(): unknown {
    throw new Error('ClaudeCodeAdapter not implemented')
  }
}
