import type { PlatformAdapter, PlatformConfigPaths } from './platform-adapter'

/**
 * Stub adapter for Codex. Not implemented in v0.1.
 */
export class CodexAdapter implements PlatformAdapter {
  readonly name = 'codex'

  // eslint-disable-next-line @typescript-eslint/require-await
  async detectInstall(): Promise<boolean> {
    throw new Error('CodexAdapter not implemented')
  }
  getConfigPaths(): PlatformConfigPaths {
    throw new Error('CodexAdapter not implemented')
  }
  getHeadlessCommand(): string[] {
    throw new Error('CodexAdapter not implemented')
  }
  parseHeadlessOutput(): unknown {
    throw new Error('CodexAdapter not implemented')
  }
}
