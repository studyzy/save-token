/**
 * Core type definitions for save-token.
 * See specs/001-token-optimizer/data-model.md for full documentation.
 */

export type Platform = 'windows' | 'macos' | 'linux'

export type OutputFormat = 'terminal' | 'json' | 'md'

export type ToolId = 'rtk' | 'caveman' | 'headroom' | 'lean-ctx' | 'graphify' | 'ponytail'

export type SuggestionType = 'install_tool' | 'config_change' | 'habit_suggestion'

export type RiskLevel = 'low' | 'medium' | 'high'

export type ActionType =
  | 'install_rtk'
  | 'install_caveman'
  | 'install_headroom'
  | 'install_lean_ctx'
  | 'install_graphify'
  | 'install_ponytail'
  | 'disable_mcp'
  | 'enable_mcp_defer_loading'
  | 'disable_plugin'
  | 'disable_skill'
  | 'enable_defer_tool_loading'
  | 'simplify_codebuddy_md'
  | 'cleanup_history'

export type DataSource = 'proxy' | 'headless' | 'fs-only'

export interface ContextItem {
  name: string
  type:
    | 'system-prompt'
    | 'system-tools'
    | 'memory-file'
    | 'skill'
    | 'mcp-tools'
    | 'hook'
    | 'message'
    | 'tool-definitions'
  estimatedTokens: number
  source: string
}

export interface ContextOverview {
  totalEstimatedTokens: number
  breakdown: ContextItem[]
}

export interface McpEntry {
  name: string
  status: 'enabled' | 'disabled'
  type: 'stdio' | 'sse' | 'http'
  command?: string
  url?: string
  toolsCount: number | null
  /** Detailed tool entries from proxy parsing (name + estimated tokens). */
  toolEntries?: { name: string; estimatedTokens: number }[]
  deferLoading: boolean
  source: 'user' | 'project'
  estimatedTokens: number
  hasCliAlternative: boolean
  cliAlternative?: string
}

export type SkillSource = 'user' | 'project' | 'plugin-marketplace'

export interface SkillEntry {
  name: string
  source: SkillSource
  sourcePath: string
  description: string
  model?: string
  context?: string
  fileSizeBytes: number
  estimatedTokens: number
  loaded: boolean | null
  /** Set when the same skill name appears from multiple sources (user + marketplace). */
  duplicateSource?: SkillSource
}

export interface RuleEntry {
  name: string
  path: string
  /** true when the rule has no paths: frontmatter — loaded in every session. */
  alwaysLoaded: boolean
  fileSizeBytes: number
  estimatedTokens: number
}

export interface PluginEntry {
  id: string
  pluginId: string
  marketplace: string
  enabled: boolean
  installedPath: string | null
  isLowFrequency: boolean
}

export interface HookEntry {
  event: string
  matcher: string
  command: string
  timeout: number | null
  source: 'settings' | 'local'
}

export interface ConfigFileSummary {
  path: string
  exists: boolean
  sizeBytes: number
  lineCount: number
  estimatedTokens: number
  impactLevel: 'low' | 'medium' | 'high'
}

export interface ToolDetection {
  name: ToolId
  installed: boolean
  enabled: boolean
  version: string | null
  installPath: string | null
  codebuddyIntegrated: boolean
  recommendedSaving: string
}

export interface DiagnosisReport {
  scanTimestamp: string
  codebuddyVersion: string | null
  platform: Platform
  contextOverview: ContextOverview
  mcpList: McpEntry[]
  skillList: SkillEntry[]
  pluginList: PluginEntry[]
  hookList: HookEntry[]
  ruleList: RuleEntry[]
  configFiles: ConfigFileSummary[]
  toolDetection: ToolDetection[]
  headlessAvailable: boolean
  dataSource: DataSource
  warnings: string[]
  /** Only populated when dataSource is 'proxy'. Contains parsed proxy details. */
  proxyDetails?: {
    model: string
    toolDefinitions: ProxyToolDef[]
    messageBreakdown: ProxyMessageBlock[]
    skillReferences: string[]
    mcpReferences: string[]
  }
}

export interface ActionPayload {
  installCommand?: string
  verifyCommand?: string
  configCommand?: string
  targetFile?: string
  operation?: 'move-to-disabled' | 'set-field' | 'move-to-disabled-dir'
  fieldName?: string
  fieldValue?: unknown
  diff?: string
}

export type WasteCategory = 'structural' | 'runtime' | 'behavioral'

export interface OptimizationSuggestion {
  id: string
  type: SuggestionType
  wasteCategory: WasteCategory
  target: string
  reason: string
  estimatedSavingTokens: number
  estimatedSavingPercent: number
  risk: RiskLevel
  reversible: boolean
  actionType: ActionType
  actionPayload: ActionPayload
}

export interface ConfigChange {
  file: string
  before: string
  after: string
  operation: string
}

export interface ToolInstallResult {
  toolId: ToolId
  success: boolean
  error?: string
  installOutput?: string
  configBackupPath?: string
  configChanges: ConfigChange[]
}

export interface BackupFileEntry {
  originalPath: string
  backupPath: string
  fileSize: number
}

export interface BackupRecord {
  timestamp: string
  operation: 'optimize' | 'config-change'
  files: BackupFileEntry[]
}

export interface AnalyzeResult {
  report: DiagnosisReport
  suggestions: OptimizationSuggestion[]
  totalEstimatedSaving: number
  totalPercent: number
}

export interface OptimizeOptions {
  tool?: ToolId
  apply?: boolean
  yes?: boolean
  dryRun?: boolean
  suggestion?: string
}

export interface DiagnoseOptions {
  format?: OutputFormat
  noHeadless?: boolean
  report?: string
  lang?: 'zh-CN' | 'en'
}

export interface AnalyzeOptions {
  format?: OutputFormat
  report?: string
  noHeadless?: boolean
  lang?: 'zh-CN' | 'en'
}

export interface RollbackOptions {
  to?: string
  lang?: 'zh-CN' | 'en'
}

export interface ReportOptions {
  format?: 'md' | 'json'
  output?: string
  noHeadless?: boolean
  lang?: 'zh-CN' | 'en'
}

export const LOW_FREQUENCY_PLUGINS = new Set<string>([
  'pptx@codebuddy-plugins-official',
  'docx@codebuddy-plugins-official',
  'xlsx@codebuddy-plugins-official',
  'agent-browser@codebuddy-plugins-official',
  'playwright-cli@codebuddy-plugins-official',
])

export const MCP_CLI_ALTERNATIVES: Record<string, string> = {
  Playwright: 'playwright',
  playwright: 'playwright',
  github: 'gh',
  'github-mcp': 'gh',
  slack: 'slack-cli',
  filesystem: 'node fs',
  notion: 'notion-cli',
  linear: 'linear-cli',
  jira: 'jira-cli',
}

export interface ProxyDiagnosisData {
  messagesByRole: Record<string, { count: number; estimatedTokens: number }>
  messageBreakdown: ProxyMessageBlock[]
  totalEstimatedTokens: number
  toolDefinitions: ProxyToolDef[]
  toolDefinitionsTokens: number
  builtinToolCount: number
  mcpToolCount: number
  systemPromptTokens: number
  memoryTokens: number
  rulesTokens: number
  skillReferences: string[]
  /** Per-skill token breakdown parsed from Skill tool definition (available_skills block). */
  skillTokens: Record<string, { description: string; estimatedTokens: number }>
  mcpReferences: string[]
  /** Plugins detected via proxy body markers (e.g. "PONYTAIL MODE ACTIVE"). */
  detectedPlugins: string[]
  model: string
}

export interface ProxyMessageBlock {
  role: string
  index: number
  contentType: string
  estimatedTokens: number
  charLength: number
  snippet: string
}

export interface ProxyToolDef {
  name: string
  category: 'builtin' | 'mcp' | 'deferred'
  estimatedTokens: number
  description: string
}

export interface ProxyCollectResult {
  ok: boolean
  error?: string
  rawBody: unknown
  parsed: ProxyDiagnosisData | null
}

export interface TraceOptions {
  port?: number
  upstream?: string
  traceDir?: string
  lang?: 'zh-CN' | 'en'
}
