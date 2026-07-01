# 研究报告: Token 优化器

**分支**: `001-token-optimizer` | **日期**: 2026-07-01
**输入**: spec.md + plan.md（已批准）+ zcf 源码调研 + CodeBuddy 官方文档调研 + blog.md 映射

## 已解决决策

### 决策 1: `codebuddy -p` 无法执行 `/context` 斜杠命令

**Decision**: 放弃通过提示词拿 `/context` 输出的方案，改用 codebuddy -p 自报 + 文件扫描 + token 估算。

**Rationale**: 实测运行 `codebuddy -p "请直接执行 /context 命令..." --output-format json --max-turns 3`，模型回复"无法执行 `/context` 斜杠命令"。`/context` 是��互模式命令，无头模式不支持。但响应 JSON 的 `rawUsage` 字段含真实 token 数（inputTokens: 25489、outputTokens: 90、cached_tokens: 3072），仅反映该次调用成本，非会话上下文分布。

**Alternatives considered**:
- 提示用户在交互会话手动跑 `/context` 然后粘贴到 st — 体验差，作为 P2 增强。
- 解析 `~/.codebuddy/sessions/*.jsonl` 提取历史 token — 格式不稳定，逆向风险高。
- 仅用文件大小估算 — 拿不到运行时实际加载的 skill/mcp 列表。

### 决策 2: token 占用分布用估算（字符数/4）

**Decision**: `TokenEstimator.estimate(content) = Math.ceil(content.length / 4)`，对所有扫描到的配置文件统一估算。

**Rationale**: 拿不到 `/context` 真实数据。字符数/4 是 OpenAI/Anthropic 通用的粗估公式（英文 ~4 字符/token，中文偏低但可接受）。明确在报告中标注"估算"。

**Alternatives considered**:
- 用 `tiktoken`/`@anthropic-ai/tokenizer` 精确计数 — 增加依赖，且不同模型 tokenizer 不同。
- 让 codebuddy -p 估算 — 模型估算不可靠。

### 决策 3: MCP 配置文件路径

**Decision**:
- 全局：`~/.codebuddy/.mcp.json`（点前缀）
- 项目级：`<cwd>/.mcp.json`

**Rationale**: zcf `constants.ts:22` 确认 `CODEBUDDY_MCP_FILE = ~/.codebuddy/.mcp.json`。实测 `cat ~/.codebuddy/.mcp.json` 结构为 `{mcpServers: {...}, disabledMcpServers: []}`。

**Alternatives considered**: `~/.codebuddy/mcp.json`（无点前缀）— zcf 调研确认是点前缀。

### 决策 4: defer_loading 配置位置

**Decision**: 在 `.mcp.json` 的 `mcpServers.{name}.defer_loading`（boolean，默认 false）或 `mcpServers.{name}.tools.{toolName}.defer_loading`（工具级覆盖服务器级）。

**Rationale**: `mcp.md:430, 505-565` 明确：
- 服务器级 `defer_loading: true` → 该 MCP 所有工具延迟加载
- 工具级 `tools.{name}.defer_loading: false` → 覆盖服务器级（单独启用）
- 继承规则：服务器 true + 工具未设置 → true；服务器 true + 工具 false → false
- 模型通过 ToolSearch 发现 + DeferExecuteTool 调用

**Alternatives considered**: `--tools "Defer(mcp__xxx__*)"` 会话级修饰符 — 仅当前会话生效，不持久化，不适合作为优化目标。

### 决策 5: enabledPlugins 结构

**Decision**: `settings.json` 的 `enabledPlugins` 对象，key 为 `{pluginId}@{marketplace}`，value 为 boolean。

**Rationale**: 实测 `cat ~/.codebuddy/settings.json` 显示：
```json
"enabledPlugins": {
  "caveman@caveman": true,
  "claude-hud@claude-hud": true,
  "find-skills@codebuddy-plugins-official": true,
  ...
}
```
禁用插件 = 将对应 key 设为 false。

**Alternatives considered**: 无（实测确认）。

### 决策 6: hooks 配置结构

**Decision**: `settings.json` 的 `hooks.{EventName}` 为数组，每项含 `matcher`（工具名或正则）+ `hooks: [{type: "command", command, timeout}]`。

**Rationale**: 实测 settings.json 显示：
```json
"hooks": {
  "PreToolUse": [
    {"hooks": [{"command": "rtk hook codebuddy", "type": "command"}], "matcher": "Bash"},
    {"matcher": "Grep|Glob", "hooks": [{"type": "command", "command": "~/.codebuddy/hooks/cbm-code-discovery-gate", "timeout": 5}]}
  ]
}
```
`settings.md:72` 确认 `hooks` 字段。每个 hook 在匹配工具调用时执行，可能注入上下文。

**Alternatives considered**: 无（实测确认）。

### 决策 7: SKILL.md 格式与来源

**Decision**:
- frontmatter: `name / description / context / model / allowed-tools`
- 来源目录：
  - 用户级：`~/.codebuddy/skills/{name}/SKILL.md`
  - 项目级：`.codebuddy/skills/{name}/SKILL.md`
  - 插件市场：`~/.codebuddy/plugins/marketplaces/{marketplace}/plugins/{pluginId}/skills/{name}/SKILL.md`

**Rationale**: `skills.md:42-59` + `codebuddy-dir.md:193-204` 确认目录结构。实测 `ls ~/.codebuddy/skills/` 显示 codebase-memory、graphify、sop.eval、sop.init（用户级）。插件市场 skill 在 `~/.codebuddy/plugins/marketplaces/` 下。

**禁用 skill 方案**:
- 项目级 skill：移到 `.codebuddy/skills/.disabled/{name}/`
- 用户级 skill：移到 `~/.codebuddy/skills/.disabled/{name}/`
- 不修改 SKILL.md frontmatter（避免格式破坏）

**Alternatives considered**: 在 frontmatter 加 `enabled: false` — skills.md 未文档化此字段，可能无效。

### 决策 8: 省 token 工具安装命令

**Decision**: 集中在 `rules.ts`，按工具 ID 分发：

| 工具 ID | 安装命令 | 验证 | CodeBuddy 配置 |
| --- | --- | --- | --- |
| rtk | `brew install rtk`（macOS）/ `curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh \| sh`（Linux） | `rtk gain` | `rtk init -g --agent codebuddy` |
| caveman | `git clone https://github.com/studyzy/caveman /tmp/caveman && cd /tmp/caveman && ./install.sh`（Fork 版，支持 codebuddy） | 检查 `~/.codebuddy/plugins/marketplaces/caveman/` 存在 | install.sh 自动配置 |
| headroom | `pip install "headroom-ai[all]"`（Fork 版 `pip install git+https://github.com/studyzy/headroom`） | `headroom --version` | `headroom mcp install`（注册到 .mcp.json） |
| lean-ctx | `brew install lean-ctx`（macOS）/ `curl -fsSL https://leanctx.com/install.sh \| sh`（Linux） | `lean-ctx doctor` | `lean-ctx setup`（自动检测 codebuddy） |
| graphify | `uv tool install graphifyy` / `pipx install graphifyy` | `graphify --version` | `graphify install --platform codebuddy` |

**Rationale**: blog.md 第四章详细列出。RTK/Caveman/Headroom 用 studyzy Fork 版（官方未支持 codebuddy）。

**节省率参考**（来自 blog.md）：
- RTK: 89%（命令输出压缩）
- Caveman: 65-75%（AI 回复压缩）
- Headroom: 47-92%（所有进上下文内容压缩）
- lean-ctx: 60-90%（读取时筛选 + 跨会话记忆）
- Graphify: 71.5 倍（代码图谱减少盲搜）

**Alternatives considered**: 无（blog.md 已给明确命令）。

## zcf 可复用模式清单

### CLI 骨架
- `cac` 命令注册（非 commander/yargs）— `cli.ts:1-13` + `cli-setup.ts:212-341`
- `bin/zcf.mjs` 极简入口（3 行）
- `main().catch(console.error)` 顶层兜底
- `withLanguageResolution` 包装器解析语言后执行

### 命令实现
- 统一 `async function + XxxOptions 接口 + try/catch`
- 错误处理：`handleExitPromptError` + `handleGeneralError`（`error-handler.ts`）
- 交互：`inquirer`（list/checkbox/input）+ `inquirer-toggle`（布尔）
- 外部命令转发：`tinyexec.x` + `stdio: 'inherit'`
- 测试环境判断：`process.env.NODE_ENV !== 'test'`

### 配置文件操作
- `readJsonConfig<T>` / `writeJsonConfig<T>` / `updateJsonConfig<T>` / `backupJsonConfig`（`json-config.ts`）
- 文件不存在返回 null，解析失败不 throw
- 备份文件名：`{原文件名}.backup_{YYYY-MM-DD_HH-mm-ss}`（dayjs）
- `fs-operations.ts` 同步 FS 包装：`exists/ensureDir/readFile/writeFile/copyFile`

### 子进程调用
- `tinyexec.exec` 返回 `{stdout, stderr, exitCode}`
- `tinyexec.x` 用于 stdio inherit
- 无统一超时封装，需自行用 AbortController + setTimeout

### i18n
- `i18next` + `i18next-fs-backend` + JSON locales
- `ensureI18nInitialized()` 守卫模式（所有用到 i18n 的函数入口校验）
- 17 命名空间，双语 zh-CN/en
- `build:done` hook 手动复制 i18n JSON 到 dist（unbuild 不自动处理）

### 类型系统
- `OperationResult { success, error?, backupPath? }` 标准结果模式
- 跨工具抽象：`CodeToolType = 'claude-code' | 'codex' | 'codebuddy'`

### 平台抽象
- `getPlatform(): 'windows' | 'macos' | 'linux'`
- `commandExists(command): Promise<boolean>`
- `wrapCommandWithSudo(command, args)` — Linux 非 root 自动加 sudo

### 测试
- vitest + globals + setup.ts（i18n 初始化）
- BDD 风格 `describe/it`
- `vi.mock('tinyexec')` 整模块 mock
- `vi.spyOn(process, 'exit')` 防止退出
- 自定义 i18n.t 翻译表 mock

## CodeBuddy 官方文档关键发现

### settings.json 完整字段（settings.md）
- `model` / `reasoningEffort`（low/medium/high/xhigh）
- `enabledPlugins` / `enabledMcpjsonServers` / `disabledMcpjsonServers` / `enableAllProjectMcpServers`
- `hooks` / `disableAllHooks` / `allowUntrustedFrontmatterHooks`
- `deferToolLoading`（全局工具延迟加载开关）
- `permissions`（allow/ask/deny/defaultMode）
- `statusLine` / `sandbox` / `autoCompactEnabled` / `alwaysThinkingEnabled`
- `showTokensCounter`（界面显示 token 计数器）

### 无头模式（headless.md）
- `codebuddy -p "<prompt>" --output-format json --json-schema '<schema>' -y --max-turns N`
- 响应 JSON 含 `rawUsage`（inputTokens/outputTokens/cached_tokens/totalTokens）
- `--allowedTools ""` 限制工具，`--setting-sources` 控制配置源
- 项目 MCP 需 `--settings '{"enableAllProjectMcpServers": true}'` 预配置

### 工具延迟加载覆盖（tool-defer-overlay.md）
- `Defer(X)` / `NoDefer(X)` 修饰符用于 `--tools` 和 agent frontmatter
- `NoDefer` 永远胜过 `Defer`
- `Defer(*)` 自动附加 ToolSearch + DeferExecuteTool（带 NoDefer 护栏）
- 修饰符不能用于 `--allowed-tools`（权限字段）

### costs.md 最佳实践（已映射到规则表）
- `/clear` 切断历史（使用习惯，st 不自动执行）
- `/compact` 压缩历史（使用习惯）
- CLI 优先于 MCP（规则表：MCP→CLI 替代）
- 禁用未使用的 MCP（规则表：禁用 MCP）
- 委托子代理（架构层，st 不涉及）
- 精确提示（使用习惯）
