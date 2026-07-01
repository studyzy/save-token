# 数据模型: Token 优化器

**分支**: `001-token-optimizer` | **日期**: 2026-07-01
**输入**: spec.md + plan.md + research.md

## 实体定义

### DiagnosisReport

一次完整扫描的结果。

```typescript
interface DiagnosisReport {
  scanTimestamp: string          // ISO 8601
  codebuddyVersion: string | null
  platform: 'windows' | 'macos' | 'linux'
  contextOverview: ContextOverview
  mcpList: McpEntry[]
  skillList: SkillEntry[]
  pluginList: PluginEntry[]
  hookList: HookEntry[]
  configFiles: ConfigFileSummary[]
  toolDetection: ToolDetection[]
  headlessAvailable: boolean     // codebuddy -p 是否可用
  warnings: string[]             // 降级提示、解析失败等
}

interface ContextOverview {
  totalEstimatedTokens: number
  breakdown: ContextItem[]
}

interface ContextItem {
  name: string
  type: 'system-prompt' | 'system-tools' | 'memory-file' | 'skill' | 'mcp-tools' | 'hook' | 'message'
  estimatedTokens: number
  source: string                 // 文件路径或来源描述
}
```

**验证规则**:
- `scanTimestamp` 必须是有效 ISO 8601
- `contextOverview.breakdown` 按 estimatedTokens 降序
- 若 `headlessAvailable = false`，`warnings` 必须包含降级原因

### McpEntry

```typescript
interface McpEntry {
  name: string
  status: 'enabled' | 'disabled'
  type: 'stdio' | 'sse' | 'http'
  command?: string               // stdio 类型
  url?: string                   // sse/http 类型
  toolsCount: number | null      // 从 headless 拿，null 表示未采集
  deferLoading: boolean
  source: 'user' | 'project'     // ~/.codebuddy/.mcp.json 还是 .mcp.json
  estimatedTokens: number        // 工具数 × 平均 token（200/工具估算）或配置大小/4
  hasCliAlternative: boolean     // 规则表是否匹配 CLI 替代
  cliAlternative?: string        // 如 "gh", "playwright"
}
```

### SkillEntry

```typescript
interface SkillEntry {
  name: string
  source: 'user' | 'project' | 'plugin-marketplace'
  sourcePath: string             // SKILL.md 完整路径
  description: string
  model?: string                 // frontmatter model 字段
  context?: string               // frontmatter context 字段
  fileSizeBytes: number
  estimatedTokens: number        // fileSizeBytes / 4
  loaded: boolean | null         // headless 是否报告已加载，null 表示未采集
}
```

### PluginEntry

```typescript
interface PluginEntry {
  id: string                     // 如 "caveman@caveman"
  pluginId: string               // "caveman"
  marketplace: string            // "caveman"
  enabled: boolean
  installedPath: string | null   // ~/.codebuddy/plugins/marketplaces/... 路径
  isLowFrequency: boolean        // 规则表标记低频
}
```

### HookEntry

```typescript
interface HookEntry {
  event: string                  // PreToolUse / PostToolUse 等
  matcher: string                // 工具名或正则
  command: string
  timeout: number | null
  source: 'settings' | 'local'  // settings.json 还是 settings.local.json
}
```

### ConfigFileSummary

```typescript
interface ConfigFileSummary {
  path: string                   // 完整路径
  exists: boolean
  sizeBytes: number
  lineCount: number
  estimatedTokens: number        // sizeBytes / 4
  impactLevel: 'low' | 'medium' | 'high'  // < 1KB / < 5KB / >= 5KB
}
// 覆盖：CODEBUDDY.md、settings.json、.mcp.json、rules/*.md、commands/*.md
```

### ToolDetection

```typescript
interface ToolDetection {
  name: 'rtk' | 'caveman' | 'headroom' | 'lean-ctx' | 'graphify'
  installed: boolean
  version: string | null
  installPath: string | null
  codebuddyIntegrated: boolean   // 是否已配置 codebuddy hook/MCP
  recommendedSaving: string      // 如 "89% 命令输出压缩"
}
```

### OptimizationSuggestion

```typescript
interface OptimizationSuggestion {
  id: string                     // 唯一标识
  type: 'install_tool' | 'config_change' | 'habit_suggestion'
  target: string                 // 工具名 / 配置项 / 习惯描述
  reason: string                 // 中文说明
  estimatedSavingTokens: number  // 估算节省
  estimatedSavingPercent: number // 占总占用百分比
  risk: 'low' | 'medium' | 'high'
  reversible: boolean
  actionType: ActionType
  actionPayload: ActionPayload   // 具体操作数据
}

type ActionType =
  | 'install_rtk' | 'install_caveman' | 'install_headroom' | 'install_lean_ctx' | 'install_graphify'
  | 'disable_mcp' | 'enable_mcp_defer_loading' | 'disable_plugin' | 'disable_skill' | 'enable_defer_tool_loading'
  | 'simplify_codebuddy_md' | 'cleanup_history'

interface ActionPayload {
  // install_tool 类
  installCommand?: string
  verifyCommand?: string
  configCommand?: string
  // config_change 类
  targetFile?: string            // ~/.codebuddy/.mcp.json 等
  operation?: 'move-to-disabled' | 'set-field' | 'move-to-disabled-dir'
  fieldName?: string             // 如 "defer_loading"
  fieldValue?: unknown
  // habit_suggestion 类
  diff?: string                  // CODEBUDDY.md 精简 diff
}
```

### ToolInstallResult

```typescript
interface ToolInstallResult {
  toolId: string
  success: boolean
  error?: string
  installOutput?: string
  configBackupPath?: string      // 配置修改前的备份路径
  configChanges: ConfigChange[]
}

interface ConfigChange {
  file: string
  before: string                 // 修改前内容
  after: string                  // 修改后内容
  operation: string
}
```

### BackupRecord

```typescript
interface BackupRecord {
  timestamp: string               // YYYYMMDDHHmmss
  operation: 'optimize' | 'config-change'
  files: BackupFileEntry[]
}

interface BackupFileEntry {
  originalPath: string
  backupPath: string             // {originalPath}.bak.{timestamp}
  fileSize: number
}
```

## 关系图

```
DiagnosisReport
├── ContextOverview
│   └── ContextItem[]
├── McpEntry[]
├── SkillEntry[]
├── PluginEntry[]
├── HookEntry[]
├── ConfigFileSummary[]
└── ToolDetection[]

OptimizationSuggestion → ActionPayload → ToolInstallResult / ConfigChange
BackupRecord ← BackupManager → BackupFileEntry[]
```

## 状态转换

### ToolDetection.installed + codebuddyIntegrated
```
未安装 → 安装中 → 已安装未集成 → 集成中 → 已集成
```

### OptimizationSuggestion 执行状态（在 tasks.md 阶段定义）
```
pending → approved → executing → completed | failed | skipped
```

## 验证规则汇总

- 所有 `estimatedTokens` 字段 = `Math.ceil(content.length / 4)`
- `McpEntry.estimatedTokens` 优先用 `toolsCount × 200`（若 toolsCount 可得），否则用配置大小/4
- `ConfigFileSummary.impactLevel`：sizeBytes < 1024 → low；< 5120 → medium；>= 5120 → high
- `OptimizationSuggestion.estimatedSavingPercent` = `estimatedSavingTokens / contextOverview.totalEstimatedTokens × 100`
- `PluginEntry.isLowFrequency`：规则表硬编码低频插件列表（如 pptx、docx、xlsx 等办公插件在编码场景低频）
