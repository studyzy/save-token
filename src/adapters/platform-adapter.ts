/**
 * Platform adapter abstraction for different AI coding agents.
 * Currently only CodeBuddy is implemented; Claude Code and Codex are stubs.
 */
export interface PlatformAdapter {
  /** Display name of the platform. */
  readonly name: string

  /** Whether the platform CLI is installed and discoverable on PATH. */
  detectInstall(): Promise<boolean>

  /** Get platform-specific configuration file paths. */
  getConfigPaths(): PlatformConfigPaths

  /** Build the headless probe command args for `codebuddy -p` style invocation. */
  getHeadlessCommand(prompt: string, schema?: object): string[]

  /** Parse raw headless stdout into structured data. */
  parseHeadlessOutput(raw: string): unknown
}

export interface PlatformConfigPaths {
  /** Global MCP config (e.g. ~/.codebuddy/.mcp.json). */
  mcp: string
  /** Global settings.json. */
  settings: string
  /** Global memory file (e.g. ~/.codebuddy/CODEBUDDY.md). */
  codebuddyMd: string
  /** User-level skills directory. */
  skillsDir: string
  /** User-level commands directory. */
  commandsDir: string
  /** User-level rules directory. */
  rulesDir: string
  /** User-level agents directory. */
  agentsDir: string
  /** Plugins marketplace root directory. */
  pluginsMarketplacesDir: string
  /** History jsonl file. */
  historyFile: string
  /** Blobs directory. */
  blobsDir: string
  /** CLI binary name on PATH. */
  cliBinary: string
}
