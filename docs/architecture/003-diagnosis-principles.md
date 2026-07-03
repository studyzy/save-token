# 诊断原理

## 问题定义

CodeBuddy 的 Token 消耗由**固定前缀**（System Prompt、Skill 定义、Tool/MCP 定义、CODEBUDDY.md）和**动态上下文**（历史消息、工具返回值、代码检索结果）共同决定。用户自身输入通常只占总 Token 的很小一部分。

`st diagnose` 的目标：**量化当前环境的 Token 占用，逐项分解出"谁在吃 Token"，为后续 optimize 提供决策依据。**

## 数据采集：三层策略

诊断的数据采集分为三个优先级，由高到低依次尝试，失败时自动降级。

### Priority 1 — Proxy 拦截（最精确）

核心思路：拦截 CodeBuddy 发给 LLM API 的真实���求体（`POST /v2/chat/completions`），**深度解析** JSON 结构，提取所有 Token 消耗项。

**流程**：

```
启动本地 HTTP Proxy（随机端口）
    ↓
设置 CODEBUDDY_BASE_URL → http://127.0.0.1:<port>/v2
    ↓
执行 codebuddy -p "Hello" -y --max-turns 1
    ↓
Proxy 透明转发所有 POST /v2/* 到真实 API
    ↓
捕获所有请求体
    ↓
恢复原始 CODEBUDDY_BASE_URL，停止 Proxy
    ↓
从捕获的 bodies 中识别主对话请求（含 messages + tools）
    ↓
深度解析 JSON：
  ├── Messages 分解：按 role 分组，每个 content block 独立统计字符数和估算 Token
  ├── Tool Definitions 分解：列出每个工具的 name、分类（内置/MCP/延迟加载）、Token 估算
  ├── Skills 提取：从所有 messages 中搜索 <available_skills> 块
  ├── MCP 提取：从 system prompt 中搜索 mcp__ 前缀工具引用
  └── Rules/Memory：从 system-reminder 块中识别 CODEBUDDY.md 和 Memory 注入
```

**解析的请求体结构**：

```
POST /v2/chat/completions
{
  "model": "deepseek-v4-pro-ioa",
  "messages": [
    { "role": "system", "content": "<system prompt + tool descriptions>" },
    { "role": "user",  "content": [
      { "type": "text", "text": "<system-reminder>Memory 指令</system-reminder>" },
      { "type": "text", "text": "<system-reminder>Hook 状态</system-reminder>" },
      { "type": "text", "text": "<codebuddyMd>CODEBUDDY.md 内容 + Rules</codebuddyMd>" },
      { "type": "text", "text": "<available_skills>Skill 列表</available_skills>" },
      { "type": "text", "text": "<user_query>用户问题</user_query>" }
    ]}
  ],
  "tools": [
    { "type": "function", "function": { "name": "Read", "description": "...", "parameters": {...} }},
    { "type": "function", "function": { "name": "Bash", "description": "...", "parameters": {...} }},
    ...
  ]
}
```

**为什么是最精确的**：

- 拿到的是 CodeBuddy **实际发给 API 的完整请求体**，不是推测或估算
- **Tools 占大头**：实测 23 个内置工具约占 20K tokens（总量 64%），这是 Token 消耗的最大单项
- 能从 system prompt 和 user messages 中精确提取所有上下文注入项
- 每个 tool definition 的 JSON 直接可用 `字符数/4` 估算 Token，误差在 ±10% 内

**局限性**：

- 需要网络访问 LLM API（可能受网络策略限制）
- Proxy 拦截仅能捕获单次请求，不能跨多轮累积统计
- Token 数是字符级估算，非 LLM API 返回的精确 `usage.input_tokens`

**关键实现**：

- `src/proxy/server.ts` — 本地 HTTP 代理服务器，拦截 POST /v2/* 请求
- `src/proxy/parser.ts` — 解析捕获的请求体为结构化诊断数据
- `src/collectors/proxy-collector.ts` — 协调整体 proxy 诊断流程

### Priority 2 — Headless 探针（次精确）

核心思路：利用 `codebuddy -p` 无头模式，让 AI 自己汇报当前环境中的 MCP 和 Skill 列表。

**流程**：

```
并行发起两个无头探针：
  1. codebuddy -p "列出所有已启用 MCP 服务器" --output-format json --json-schema '<schema>' -y --max-turns 2
  2. codebuddy -p "列出已加载的 Skills" --output-format json --json-schema '<schema>' -y --max-turns 2
    ↓
解析 JSON 响应
    ↓
与文件系统采集数据合并（mergeMcpLists / mergeSkillLists）
```

**探针设计**：

- 使用 `--json-schema` 约束输出格式，确保返回结构化 JSON
- 使用 `--max-turns 2` 限制最大轮数，防止模型无限制调用工具
- 使用 `-y` 跳过确认提示

**合并逻辑**：

- MCP 合并：以文件系统扫描为基准，用 headless 结果补充 `toolsCount` 和 `status` 字段
- Skill 合并：以 headless 结果为权威来源（反映实际加载状态），用文件系统数据补充元信息（sourcePath、fileSizeBytes、estimatedTokens）。如果 headless 无数据，则标记所有 skill 为 `loaded: false`

**局限性**：

- 模型可能汇报不完整或有误差
- 无法拿到 system prompt 的实际内容
- 无法获取真实的上下文分布

**关键实现**：

- `src/collectors/headless-collector.ts` — 封装 `codebuddy -p` 调用
- `src/utils/prompt-templates.ts` — 探针 prompt 和 JSON Schema 模板
- `src/commands/diagnose.ts` 中的 `mergeMcpLists()` / `mergeSkillLists()`

### Priority 3 — 文件系统扫描（保底）

直接读取 `~/.codebuddy/` 目录下的配置文件，不依赖 `codebuddy` 进程运行。

**扫描范围**：

| 目标            | 路径                                              | 提取内容                                   |
| --------------- | ------------------------------------------------- | ------------------------------------------ |
| MCP 配置        | `~/.codebuddy/.mcp.json`                          | 服务器名、类型、状态、工具数估算           |
| Settings        | `~/.codebuddy/settings.json`                      | 插件列表、Hook 配置、deferToolLoading 设置 |
| Skills          | `~/.codebuddy/skills/`                            | 名称、来源、文件大小、Token 估算           |
| 项目 Skills     | `.codebuddy/skills/`                              | 同上                                       |
| 插件市场 Skills | `~/.codebuddy/plugins/marketplaces/`              | 仅已启用插件中的 skill                     |
| Commands        | `~/.codebuddy/commands/` + `.codebuddy/commands/` | 作为类 skill 条目统计                      |
| Rules           | `~/.codebuddy/rules/`                             | 规则名、是否 always-loaded、Token 估算     |
| CODEBUDDY.md    | `~/.codebuddy/CODEBUDDY.md`                       | 大小、行数、Token 估算                     |
| 历史文件        | `~/.codebuddy/history.jsonl`                      | 文件大小                                   |

**关键设计**：

- **Commands 作为 Skill 统计**：CodeBuddy 在 `/context` 中把 "Skills and slash commands" 放在一起展示，因此 commands 目录下的 `.md` 文件按类 skill 条目纳入统计，Token 估算使用描述文本长度而非完整文件大小（因为实际注入上下文的主要是描述部分）
- **重复 Skill 检测**：同一 skill 名可能同时出现在 user 和 plugin-marketplace 来源中，会标记 `duplicateSource` 字段
- **MCP CLI 替代识别**：部分 MCP 有对应的 CLI 工具（如 Playwright → `playwright`、GitHub → `gh`），会在条目中标记 `hasCliAlternative` 和 `cliAlternative`

**关键实现**：

- `src/collectors/fs-collector.ts` — 文件系统扫描主逻辑
- `src/collectors/token-estimator.ts` — Token 估算

## Token 估算方法

由于 CodeBuddy 的 `/context` 斜杠命令在无头模式（`codebuddy -p`）中不可执行，诊断工具使用**估算**而非精确计数。

### 估算公式

纯 ASCII 文本（源代码、配置文件）：

```
estimatedTokens = Math.ceil(content.length / 3.3)
```

混合 CJK 文本：

```
estimatedTokens = Math.ceil(ASCII长度 / 3.3) + CJK字符数
```

### 为什么是 3.3 而非 4.0？

常见估算用 `字符数/4`，但实际测量（对照 cl100k / Claude BPE 分词器家族）发现：

- 纯 ASCII 代码的 chars/token 约 3.3，用 4.0 会**低估约 17%**
- CJK 字符约 1 token/字符，用 4.0 会**低估约 3 倍**

### MCP 工具估算

当无法获取精确 toolsCount 时，MCP Token 按配置 JSON 大小估算。当 toolsCount 已知时：

```
estimatedTokens = toolsCount * 200
```

200 token/工具是基于典型 tool definition（含 description、parameters schema）的平均值。

### 文件影响级别

| 级别   | 大小阈值  | 含义       |
| ------ | --------- | ---------- |
| low    | < 1KB     | 影响可忽略 |
| medium | 1KB ~ 5KB | 有一定影响 |
| high   | >= 5KB    | 显著影响   |

## 诊断报告结构

`DiagnosisReport` 是诊断的最终输出，包含以下字段：

```typescript
{
  scanTimestamp: string          // 扫描时间戳
  codebuddyVersion: string|null  // codebuddy 版本
  platform: 'macos'|'linux'|'windows'
  contextOverview: {             // 上下文占用总览
    totalEstimatedTokens: number
    breakdown: ContextItem[]     // 逐项分解
  }
  mcpList: McpEntry[]            // MCP 服务器列表
  skillList: SkillEntry[]        // Skill 列表（含 loaded 状态）
  pluginList: PluginEntry[]      // 插件列表
  hookList: HookEntry[]          // Hook 列表
  ruleList: RuleEntry[]          // Rules 列表
  configFiles: ConfigFileSummary[] // 配置文件摘要
  toolDetection: ToolDetection[] // 省 Token 工具安装检测
  headlessAvailable: boolean     // 无头模式是否可用
  dataSource: 'proxy'|'headless'|'fs-only'  // 数据来源
  warnings: string[]             // 警告信息
  proxyDetails?: {               // Proxy 模式专用，深度解析数据
    model: string                // 实际使用的模型
    toolDefinitions: ProxyToolDef[]  // 工具定义分解（名称/分类/Token）
    messageBreakdown: ProxyMessageBlock[]  // 消息分解（role/block/Token）
    skillReferences: string[]    // 从请求体中提取的 skill 名称
    mcpReferences: string[]      // 从请求体中提取的 MCP 引用
  }
}
```

## 数据来源降级策略

```
┌─────────────────────┐
│  codebuddy 已安装？  │── 否 ──→ dataSource = 'fs-only'
└───────┬─────────────┘
        │ 是
        ▼
┌─────────────────────┐
│  --noHeadless 标志？ │── 是 ──→ dataSource = 'fs-only'
└───────┬─────────────┘
        │ 否
        ▼
┌─────────────────────┐
│  Proxy 拦截成功？    │── 是 ──→ dataSource = 'proxy'（最精确）
└───────┬─────────────┘
        │ 否
        ▼
┌─────────────────────┐
│  无头探针成功？      │── 是 ──→ dataSource = 'headless'（次精确）
└───────┬─────────────┘
        │ 否
        ▼
    dataSource = 'fs-only'（保底）
```

## 工具检测

诊断同时检测 5 个省 Token 工具的安装状态：

| 工具     | 类型   | 预估节省           | 检测方式                    |
| -------- | ------ | ------------------ | --------------------------- |
| rtk      | CLI    | ~89% 命令输出压缩  | `commandExists('rtk')`      |
| caveman  | Plugin | 65-75% AI 回复压缩 | 检查 `enabledPlugins`       |
| headroom | CLI    | 47-92% 上下文压缩  | `commandExists('headroom')` |
| lean-ctx | CLI    | 60-90% 读取筛选    | `commandExists('lean-ctx')` |
| graphify | CLI    | 71.5x 代码图谱     | `commandExists('graphify')` |

检测结果直接写入 `toolDetection` 字段，后续 optimize 命令据此判断哪些工具需要安装。

## 架构关键决策

1. **不逆向内部格式**：所有数据通过公开接口获取（文件系统 + `codebuddy -p` + Proxy 拦截），不解析 CodeBuddy 内部数据结构或通信协议
2. **Proxy 优先，深度解析**：Proxy 模式能拿到实际发给 LLM 的完整 JSON，是最精确的数据源。Parser 对其深度解析：分解 messages、分类 tools（内置/MCP/延迟加载）、提取 skills/MCP/rules 引用
3. **Tools 是大头**：实测 23 个内置工具约 20K tokens（占总请求 ~64%），工具定义是 Token 消耗最大的单项，诊断报告需要单独展示
4. **降级不阻塞**：任何采集层失败时自动降级，保证诊断命令始终有输出
5. **估算而非精确计数**：接受 Token 估算的误差范围（±10%），不追求无法获取的精确数据。字符数/4 是简单有效的近似
6. **Skill loaded 状态依赖 Proxy/探针**：只有 Proxy 拦截或 headless 探针能判断 skill 是否"实际加载"，纯文件系统扫描无法区分
7. **Commands 归入 Skill 统计**：与 CodeBuddy `/context` 的展示逻辑保持一致
8. **settings.json 不计入 Token**：settings.json 是 CodeBuddy 自消费配置，不发送给 LLM API，不计入 contextOverview

## 相关 ADR

- [ADR-001: 双层数据采集架构](./001-dual-layer-collection.md)
- [ADR-002: dry-run 默认 + 备份策略](./002-dry-run-and-backup.md)
