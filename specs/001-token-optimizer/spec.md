# 功能规范: Token 优化器 (Token Optimizer)

**功能分支**: `001-token-optimizer`
**创建时间**: 2026-07-01
**状态**: 草稿
**输入**: 用户描述: "扫描诊断 CodeBuddy 状态并优化 Token 使用：诊断已安装的 MCP/SKILL/工具，生成优化建议报告，按报告执行优化操作"

## 核心思路

本工具是一个 **外部 CLI 工具**（`st` 命令），通过**调用 CodeBuddy 自身的无头模式**（`codebuddy -p`）来获取诊断数据，而非自行解析 CodeBuddy 的内部状态。

**关键洞察**：CodeBuddy 已内置 `/context`、`/cost`、`/mcp`、`/skills` 等命令，能输出当前会话的真实 token 占用、MCP 列表、Skill 列表等精确数据。本工具通过 `codebuddy -p "<提示词>" --output-format json --json-schema '<schema>'` 的方式，让 CodeBuddy 自己报告自己的状态，得到结构化 JSON 数据。

这样做的好处：
- **数据精确**：直接拿到 CodeBuddy 内部计算的真实 token 数，而非基于文件大小的估算
- **抗版本变化**：CodeBuddy 升级后内部数据结构变化，只要提示词稳定就能拿到数据
- **实现简单**：不依赖逆向 CodeBuddy 内部存储格式

## 用户场景与测试 *(必填)*

### 用户故事 1 - 一键诊断 CodeBuddy 环境 (优先级: P1)

作为 CodeBuddy 用户，我希望运行一条命令就能全面扫描当前 CodeBuddy 的运行环境，了解 MCP 服务、SKILL、插件、配置文件、上下文 token 占用等状态，以便清楚地知道哪些东西在消耗我的 Token 额度。

**优先级原因**: 诊断是优化的前提。没有诊断数据，用户无法做出任何有意义的优化决策。这是整个工具的核心基础。

**独立测试**: 运行 `st diagnose` 命令，立即获得一份结构化的诊断报告，显示所有检测到的配置项及其真实 token 占用。不需要后续步骤即可交付价值。

**数据采集方式**:
- 调用 `codebuddy -p "请输出 /context 命令的完整内容"` 拿到当前会话上下文占用（System prompt / System tools / Memory files / Messages / Skills 各项的真实 token 数）
- 调用 `codebuddy -p "请列出当前所有可用的 MCP 服务器及其工具"` + JSON Schema 约束输出结构
- 调用 `codebuddy -p "请列出当前所有已加载的 Skills 及其 token 占用"` + JSON Schema
- 直接读取文件系统：`~/.codebuddy/CODEBUDDY.md`、`~/.codebuddy/settings.json`、`~/.codebuddy/.mcp.json`、`~/.codebuddy/plugins/marketplaces/`、`~/.codebuddy/hooks/`、`~/.codebuddy/commands/`、`~/.codebuddy/rules/`
- 直接读取文件系统：项目级 `.codebuddy/` 目录（如存在）

**验收场景**:

1. **给定** 用户已安装 CodeBuddy 并配置了若干 MCP，**当** 用户运行 `st diagnose` 时，**那么** 报告列出所有已启用的 MCP 服务名称、状态、以及每个 MCP 添加到上下文的工具定义数量（如能拿到 token 数则一并给出）。
2. **给定** 用户的 `~/.codebuddy/CODEBUDDY.md` 文件存在，**当** 用户运行 `st diagnose` 时，**那么** 报告显示该文件的大小（字节数 / 行数 / 估算 token 数 ≈ 字符数/4），并标注其在 `/context` 中的真实 token 占用（从 `/context` 输出中提取）。
3. **给定** 用户已安装若干 SKILL（内置 + 插件市场），**当** 用户运行 `st diagnose` 时，**那么** 报告列出每个 SKILL 的名称、来源（user/project/plugin-marketplace）、以及从 `/context` 中读取到的真实 token 占用。
4. **给定** 用户已启用若干插件（`settings.json` 的 `enabledPlugins`），**当** 用户运行 `st diagnose` 时，**那么** 报告列出每个插件的名称、启用状态、来源 marketplace。
5. **给定** 用户的 `settings.json` 配置了 `hooks`（如 PreToolUse 中的 RTK hook、code-discovery-gate 等），**当** 用户运行 `st diagnose` 时，**那么** 报告列出每个 hook 的 matcher、命令、timeout，并提示这些 hook 会在每次匹配工具调用时执行。
6. **给定** 用户环境无任何 CodeBuddy 配置（`~/.codebuddy/` 不存在），**当** 用户运行 `st diagnose` 时，**那么** 系统提示"未检测到 CodeBuddy 安装"并给出安装指引。
7. **给定** `codebuddy` 命令不在 PATH 中，**当** 用户运行 `st diagnose` 时，**那么** 系统报错并提示"需要 CodeBuddy CLI 2.x+ 才能运行诊断"。
8. **给定** 诊断数据采集完成，**当** 报告生成时，**那么** 报告顶部显示 `/context` 的总览（已用 token / 总额 / 占比），并按占用降序列出前 5 大消耗项。

---

### 用户故事 2 - 生成优化建议报告 (优先级: P2)

作为 CodeBuddy 用户，我希望在诊断完成后自动获得一份优化建议报告，告诉我哪些 SKILL 可以关闭、哪些 MCP 可以用 CLI 替代、哪些 hooks 配置可以精简、有哪些更好的工具可以安装，并量化预估优化后的 Token 节省量。

**优先级原因**: 诊断告诉用户"现状"，建议告诉用户"该怎么做"。这是从信息到行动的桥梁。

**独立测试**: 运行 `st analyze`（或 `st diagnose --analyze`）命令，在诊断报告基础上附加一份优化建议报告。用户可以独立阅读建议并手动执行，不依赖自动执行功能。

**建议生成规则**（基于 CodeBuddy 官方文档 `costs.md` 的最佳实践）:

| 建议类型 | 触发条件 | 建议内容 |
| --- | --- | --- |
| 关闭 SKILL | SKILL token 占用 > 500 且非高频使用 | 建议禁用，说明节省量 |
| MCP 替代为 CLI | MCP 存在已知 CLI 等价物（如 Playwright MCP → playwright CLI、gh CLI 替代 github MCP、aws CLI 替代 aws MCP） | 建议禁用 MCP 并改用 CLI，说明 CLI 不占用持久上下文 |
| MCP 启用延迟加载 | MCP 工具定义多但低频使用 | 建议在 `.mcp.json` 中设置 `defer_loading: true` 或在 agent 配置中使用 `Defer(mcp__xxx__*)` |
| 精简 CODEBUDDY.md | 文件 > 200 行或 > 5KB | 建议精简，指出可移至项目级或删除的段落 |
| 精简 hooks | hooks 中存在重复 matcher 或低效命令 | 建议合并或移除 |
| 精简 commands/ | commands 数量 > 10 且部分未使用 | 建议归档未使用的 slash command |
| 安装工具 | 检测到未安装 Headroom（压缩）/ Caveman（压缩模式）/ RTK（token 计数） | 推荐安装并说明节省原理 |
| 启用延迟加载 | `settings.json` 未配置 `deferToolLoading` | 建议启用全局工具延迟加载 |
| 清理历史数据 | `~/.codebuddy/history.jsonl` > 50MB 或 `blobs/` > 100MB | 建议清理（不影响 token，但释放磁盘） |

**验收场景**:

1. **给定** 诊断报告显示多个 SKILL 已加载，**当** 系统生成优化建议时，**那么** 每个 SKILL 被评估为"建议保留"或"建议关闭"，并附上原因和预估节省 token 数。
2. **给定** 诊断报告显示 Playwright MCP 已启用，**当** 系统生成优化建议时，**那么** 建议关闭该 MCP 并改用 `playwright` CLI（因为 CLI 不占用持久上下文工具定义）。
3. **给定** 诊断报告显示 CODEBUDDY.md 文件过大，**当** 系统生成优化建议时，**那么** 建议精简内容，并指出哪些部分可移到项目级 CODEBUDDY.md 或删除。
4. **给定** 诊断报告显示未安装 Headroom / Caveman / RTK，**当** 系统生成优化建议时，**那么** 推荐安装这些工具并说明各自的 Token 节省原理（压缩 / 压缩模式 / token 计数）。
5. **给定** 诊断报告显示 MCP 工具定义数量多但 `defer_loading` 未启用，**当** 系统生成优化建议时，**那么** 建议为该 MCP 启用延迟加载。
6. **给定** 诊断数据完整，**当** 优化建议生成后，**那么** 报告底部显示预估总 Token 节省量（绝对值 + 占当前占用的百分比）。
7. **给定** 用户运行 `st analyze --format json`，**当** 命令执行时，**那么** 输出机器可读的 JSON 格式建议列表，每条建议包含 `type / target / reason / estimatedSavingTokens / risk / reversible / action` 字段。

---

### 用户故事 3 - 生成并应用优化操作 (优先级: P3)

作为 CodeBuddy 用户，我希望系统能够按照优化建议生成具体的修改方案（diff 形式），我确认后自动应用，包括禁用 SKILL、禁用 MCP、精简配置文件等，并支持回滚。

**优先级原因**: 自动化执行是体验的最高点，但必须在诊断和建议都完备的基础上才有意义。出于安全考虑，默认 dry-run，必须显式 `--apply` 才真修改。

**独立测试**: 运行 `st optimize --dry-run`（默认）查看将要执行的修改 diff；运行 `st optimize --apply` 真正应用。

**验收场景**:

1. **给定** 优化建议报告中包含 5 条建议，**当** 用户运行 `st optimize`（不带参数）时，**那么** 系统以交互式列表展示每条建议的 diff 预览（before/after），用户可以选择全部应用、逐条确认或取消。
2. **给定** 用户选择关闭某个 SKILL（插件类），**当** 系统执行优化时，**那么** 系统修改 `settings.json` 的 `enabledPlugins` 将该项设为 `false`，先备份原文件到 `settings.json.bak.{timestamp}`，并提示操作结果。
3. **给定** 用户选择用 CLI 替代某个 MCP，**当** 系统执行优化时，**那么** 系统将 MCP 从 `.mcp.json` 中移至 `disabledMcpServers` 数组（而非直接删除），并提示用户安装对应 CLI 工具的命令（不自动安装）。
4. **给定** 用户选择精简 CODEBUDDY.md，**当** 系统执行优化时，**那么** 系统生成精简后的内容 diff，用户确认后写入，原文件备份为 `CODEBUDDY.md.bak.{timestamp}`。
5. **给定** 任何优化操作执行失败（如文件权限问题），**当** 操作失败时，**那么** 系统回滚已执行的操作（从备份恢复），并显示清晰的错误信息和恢复建议。
6. **给定** 用户以非交互模式运行 `st optimize --apply --yes`，**当** 命令执行时，**那么** 系统跳过确认直接应用所有建议，适用于脚本场景。
7. **给定** 用户运行 `st optimize --dry-run --report report.md`，**当** 命令执行时，**那么** 系统仅生成包含所有 diff 预览的报告文件，不修改任何配置。
8. **给定** 优化已应用，**当** 用户运行 `st rollback` 时，**那么** 系统从最近的备份恢复所有修改的文件。

---

### 边界情况

- 当 `~/.codebuddy/` 目录不存在时，系统应友好提示用户 CodeBuddy 尚未初始化，并给出安装指引。
- 当 `codebuddy` 命令不在 PATH 中时，系统应报错退出，不尝试运行诊断。
- 当 `codebuddy -p` 调用超时（默认 60 秒）或返回非零退出码时，系统应报告错误并降级为"仅文件系统扫描"模式（跳过基于无头模式的数据采集，只报告文件大小等可直接读取的信息）。
- 当配置文件中存在 JSON 语法错误时，系统应报告解析失败的具体文件和行号，而非崩溃。
- 当 `history.jsonl` 异常庞大（>100MB）时，系统应警告并建议清理，但**绝不自动删除**。
- 当 MCP 配置引用了不存在的服务时，系统应标记为"无效配置"而非忽略。
- 当用户同时运行多个 `st optimize --apply` 实例时，系统应通过文件锁（`~/.codebuddy/.st.lock`）检测并拒绝并发执行，防止配置损坏。
- 当备份文件已存在时（如重复执行优化），系统应创建带时间戳的新备份而非覆盖旧备份。
- 当 `/context` 输出无法解析（CodeBuddy 版本不兼容导致格式变化）时，系统应保留原始文本输出并提示"无法自动解析，请手动查看"。

## 需求 *(必填)*

### 功能需求

- **FR-001**: 系统必须提供 `st diagnose` 命令，扫描并展示 CodeBuddy 环境的完整诊断信息。
- **FR-002**: 诊断信息必须通过以下两种方式采集：
  - **无头模式采集**：调用 `codebuddy -p "<提示词>" --output-format json --json-schema '<schema>' -y --allowedTools ""` 获取 `/context`、`/mcp`、`/skills` 等内置命令的结构化输出（无头模式不进入交互，无副作用）。
  - **文件系统采集**：直接读取 `~/.codebuddy/` 和项目 `.codebuddy/` 下的配置文件（CODEBUDDY.md、settings.json、.mcp.json、plugins/、hooks/、commands/、rules/）。
- **FR-003**: 诊断报告必须包含：
  - `/context` 总览：已用 token / 总额 / 占比，按类别（System prompt / System tools / Memory files / Skills / Messages）分解
  - MCP 列表：名称、状态（enabled/disabled）、工具数量、来源（user/project）
  - SKILL 列表：名称、来源（user/project/plugin-marketplace）、token 占用
  - 插件列表：名称、启用状态、来源 marketplace
  - 配置文件：CODEBUDDY.md（行数/字节/token 估算）、settings.json（关键字段：model、enabledPlugins、hooks、deferToolLoading）
  - hooks 列表：event、matcher、command、timeout
  - 第三方工具检测：RTK（hook 中检测）、Headroom（MCP 中检测）、Caveman（插件中检测）的安装状态
- **FR-004**: 系统必须提供 `st analyze` 命令（或 `st diagnose --analyze` 选项），基于诊断数据按"建议生成规则表"��成优化建议报告。
- **FR-005**: 优化建议必须包含字段：`type / target / reason / estimatedSavingTokens / risk（low/medium/high）/ reversible（bool）/ action（具体操作描述）`。
- **FR-006**: 系统必须提供 `st optimize` 命令，默认 `--dry-run` 模式仅展示 diff，`--apply` 才真修改。
- **FR-007**: 优化执行必须支持选择性执行——用户可以逐条确认或选择全部应用；`--yes` 跳过确认。
- **FR-008**: 任何修改文件的操作必须先创建带时间戳的备份（`<file>.bak.<YYYYMMDDHHmmss>`），操作失败时必须支持从备份回滚。
- **FR-009**: 系统必须提供 `st rollback` 命令，从最近的备份恢复所有被 `st optimize --apply` 修改的文件。
- **FR-010**: 诊断和优化报告必须支持多种输出格式：终端彩色输出（默认）、JSON（`--format json`）、Markdown（`--format md`，可导出到文件 `--report <path>`）。
- **FR-011**: 所有命令必须支持 `--help` 显示详细的使用说明。
- **FR-012**: 系统必须提供 `st report` 命令，将上一次诊断+建议报告导出为 Markdown 文件到指定路径（默认 `./st-report-{timestamp}.md`）。

### 关键实体 *(如果功能涉及数据则包含)*

- **诊断报告 (DiagnosisReport)**: 一次完整扫描的结果，包含 contextOverview、mcpList、skillList、pluginList、configFiles、hooksList、toolDetection、scanTimestamp、codebuddyVersion。
- **优化建议 (OptimizationSuggestion)**: 单条建议，字段：type、target、reason、estimatedSavingTokens、risk、reversible、action。
- **优化操作 (OptimizationAction)**: 单条建议对应的可执行操作，字段：suggestionId、operationType（disablePlugin/disableMcp/deferMcp/editFile/installTool）、targetFile、beforeContent、afterContent、backupPath、status、error。
- **PlatformAdapter（扩展接口）**: 抽象不同 CLI 工具（CodeBuddy / Claude Code / Codex）的差异，方法：`detectInstall() / getHeadlessCommand(prompt, schema) / getConfigPaths() / parseContextOutput(rawText)`。本期仅实现 `CodeBuddyAdapter`，但接口预留。

## 成功标准 *(必填)*

### 可衡量的结果

- **SC-001**: 用户能在 30 秒内完成一次完整的 CodeBuddy 环境诊断（含 `codebuddy -p` 调用，容忍其启动开销）。
- **SC-002**: 优化建议报告的准确率至少 80%（建议的操作确实有助于减少 Token 消耗，且建议的替代方案确实可行）。
- **SC-003**: 执行优化操作后，用户的 CodeBuddy 上下文 token 占用（以 `/context` 输出为准）减少至少 15%。
- **SC-004**: 95% 的优化操作能成功执行并正确回滚（在需要回滚的场景下）。
- **SC-005**: 非交互模式下的优化操作能在 10 秒内完成（不含 `codebuddy -p` 调用）。
- **SC-006**: 用户首次使用即可在 3 条命令内完成"诊断 → 查看建议 → 执行优化"的完整流程：`st diagnose` → `st analyze` → `st optimize --apply`。
- **SC-007**: `codebuddy -p` 调用失败时，系统必须能降级为仅文件系统扫描模式并明确提示用户数据不完整。

## 假设

- 用户已安装 CodeBuddy CLI 2.x+ 并能在 PATH 中访问 `codebuddy` 命令。
- `codebuddy -p` 无头模式在 `-y --allowedTools ""` 下能安全执行只读诊断提示词（不产生副作用）。
- 用户的 CodeBuddy 配置遵循官方标准路径（`~/.codebuddy/` 全局，`.codebuddy/` 项目级）。
- `/context` 输出格式遵循 `costs.md` 文档中描述的结构（System prompt / System tools / Memory files / Skills / Messages 分类），如格式变化系统应保留原始文本并降级。
- Token 估算优先使用 `/context` 的真实数据；对未在 `/context` 中显示的项（如 MCP 工具定义数），使用"工具定义数 × 平均 token"粗略估算并标注为估算值。
- MCP 与 CLI 的替代关系基于已知的常见方案（见"建议生成规则表"），后续可通过配置文件扩展映射。
- 优化操作仅修改 CodeBuddy 相关配置文件（`~/.codebuddy/` 和项目 `.codebuddy/`），不修改系统级设置。
- 第一期仅支持 CodeBuddy，通过 `PlatformAdapter` 接口预留 Claude Code 和 Codex 的扩展。

## 范围界定

### 包含

- CodeBuddy 环境的诊断扫描（通过 `codebuddy -p` 无头模式 + 文件系统读取）
- 优化建议的生成和展示（基于官方 `costs.md` 文档的最佳实践规则）
- 优化操作的自动执行（默认 dry-run，`--apply` 真修改，`st rollback` 回滚）
- 多格式输出支持（终端彩色 / JSON / Markdown）
- `PlatformAdapter` 抽象接口（仅实现 CodeBuddy 适配器）

### 不包含（本期）

- Claude Code 和 Codex 的支持（仅预留 `PlatformAdapter` 接口和 `ClaudeCodeAdapter` / `CodexAdapter` 的空实现）
- Token 消耗的实时监控（仅扫描时快照，不做持续监控）
- 云端配置同步
- GUI 界面
- 自动安装推荐工具（仅提示安装命令，由用户手动执行）
- 修改 `history.jsonl` / `blobs/` 等运行时数据（仅提示清理建议）

## 技术实现参考

### 项目结构（参考 ~/Code/zcf）

```
save-token/
├── bin/
│   └── st.mjs                    # CLI 入口
├── src/
│   ├── cli.ts                    # 命令注册（commander/yargs）
│   ├── commands/
│   │   ├── diagnose.ts
│   │   ├── analyze.ts
│   │   ├── optimize.ts
│   │   ├── rollback.ts
│   │   └── report.ts
│   ├── adapters/
│   │   ├── platform-adapter.ts   # 抽象接口
│   │   ├── codebuddy-adapter.ts  # CodeBuddy 实现
│   │   ├── claude-code-adapter.ts # 空实现（预留）
│   │   └── codex-adapter.ts      # 空实现（预留）
│   ├── collectors/
│   │   ├── headless-collector.ts # 调用 codebuddy -p 采集
│   │   └── fs-collector.ts       # 文件系统扫描
│   ├── analyzers/
│   │   ├── suggestion-engine.ts  # 建议生成规则
│   │   └── rules.ts              # 规则定义（MCP→CLI 映射等）
│   ├── executors/
│   │   ├── optimize-executor.ts  # 生成 diff + 应用
│   │   └── backup-manager.ts     # 备份/回滚
│   ├── types/
│   │   └── index.ts
│   ├── i18n/
│   │   ├── locales/zh-CN/
│   │   └── locales/en/
│   └── utils/
│       ├── prompt-templates.ts   # 发给 codebuddy 的提示词模板
│       ├── json-schemas.ts      # 结构化输出的 JSON Schema
│       └── output.ts            # 彩色终端输出
├── tests/
├── package.json                  # type: module, ESM
├── tsconfig.json
└── vitest.config.ts
```

### 技术栈

- **语言**: TypeScript + ESM（参考 zcf 的 `package.json` 配置：`"type": "module"`）
- **构建**: unbuild（与 zcf 一致）
- **包管理**: pnpm
- **CLI 框架**: commander 或 yargs
- **测试**: vitest（与 zcf 一致）
- **lint**: eslint（与 zcf 一致）
- **运行时**: Node.js 18+

### 关键提示词模板（prompt-templates.ts 示例）

```typescript
// 提示词设计原则：让 codebuddy 输出结构化数据，配合 --json-schema 约束
export const CONTEXT_PROBE_PROMPT = `请执行 /context 命令并将其完整原始输出原样返回，不要做任何总结或改写。`;

export const MCP_LIST_PROMPT = `请列出当前会话所有可用的 MCP 服务器。对每个服务器输出：name、status(enabled/disabled)、toolsCount、source(user/project)。仅返回 JSON。`;

export const SKILL_LIST_PROMPT = `请列出当前会话所有已加载的 Skills。对每个 skill 输出：name、source(user/project/plugin)、tokens(从 /context 输出中读取，无则填 null)。仅返回 JSON。`;
```

### 调用 codebuddy 的封装

```typescript
// headless-collector.ts 核心逻辑
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
const execAsync = promisify(exec);

export async function probe(prompt: string, schema?: object): Promise<any> {
  const args = [
    'codebuddy', '-p', prompt,
    '--output-format', 'json',
    '-y', '--allowedTools', '""',
  ];
  if (schema) args.push('--json-schema', JSON.stringify(schema));
  const { stdout } = await execAsync(args.join(' '), { timeout: 60000 });
  return JSON.parse(stdout);
}
```
