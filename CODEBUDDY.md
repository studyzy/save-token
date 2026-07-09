# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## 项目概述

`save-token` 是 CodeBuddy Token 占用诊断与优化 CLI 工具。通过三层数据采集策略（Proxy 拦截 → headless 探针 → 文件系统扫描）诊断 Token 占用、生成优化建议、自动安装省 Token 工具并优化配置。对外暴露的命令是 `st`。

## 开发命令

```bash
# 开发模式运行（直接执行 TypeScript 源码）
pnpm dev                          # 等效 tsx ./src/cli.ts
pnpm dev -- diagnose              # 传递子命令参数

# 构建
pnpm build                        # unbuild，输出到 dist/，同时复制 i18n JSON 到 dist/i18n/

# 类型检查
pnpm typecheck                    # tsc --noEmit

# Lint
pnpm lint                         # eslint
pnpm lint:fix                     # eslint --fix

# 测试
pnpm test                         # vitest（交互模式）
pnpm test:run                     # vitest run（单次运行）
pnpm test:coverage                # vitest run --coverage（含覆盖率报告）
npx vitest run tests/commands/diagnose.test.ts  # 运行单个测试文件
npx vitest run -t "test name"                    # 按名称筛选运行单个测试
```

## 架构总览

### 入口与 CLI 层

- `src/cli.ts` — CLI 入口，使用 `cac` 注册 `st` 命令
- `src/cli-setup.ts` — 注册 diagnose / analyze / optimize / rollback / report 五个子命令，支持 `--noHeadless` 跳过 headless/proxy 探测，在注册前先调用 `initI18n(lang)`，语言由环境变量 `ST_LANG` 控制（默认 `zh-CN`）

### 适配器模式（Adapter）

- `src/adapters/platform-adapter.ts` — `PlatformAdapter` 接口定义：检测安装、获取配置路径、构建 headless 命令、解析输出。目前仅有 CodeBuddy 实现
- `src/adapters/codebuddy-adapter.ts` — 唯一可用的实现，返回 `~/.codebuddy/` 下所有配置路径，headless 命令格式为 `codebuddy -p <prompt> --output-format json --json-schema '<schema>' -y --max-turns 2`
- `src/adapters/claude-code-adapter.ts` 和 `src/adapters/codex-adapter.ts` — 空桩，未实现

### 命令层（Commands）

5 个命令，都通过 `CodeBuddyAdapter` 获取平台信息：

| 命令          | 文件                       | 核心逻辑                                                                 |
| ------------- | -------------------------- | ------------------------------------------------------------------------ |
| `st diagnose` | `src/commands/diagnose.ts` | 三层降级采集（proxy → headless → fs-only）→ 合并数据 → `DiagnosisReport` |
| `st analyze`  | `src/commands/analyze.ts`  | 先 diagnose → 规则引擎生成建议 → 计算总节省                              |
| `st optimize` | `src/commands/optimize.ts` | diagnose → 生成建议 → dry-run 预览 / `--apply` 执行                      |
| `st rollback` | `src/commands/rollback.ts` | 从 `~/.codebuddy/.st-backup-*.json` 恢复                                 |
| `st report`   | `src/commands/report.ts`   | diagnose + analyze → 写入 Markdown/JSON 报告文件                         |

`diagnose` 的数据采集按三层降级：Priority 1 — Proxy 拦截 `POST /v2/chat/completions` 请求体（最精确，能拿到实际发给 LLM 的完整 JSON）；Priority 2 — headless 探针让 AI 自报 MCP/Skill 列表；Priority 3 — 文件系统扫描 `~/.codebuddy/` 目录。失败时自动降级，保证始终有输出。`mergeMcpLists()` / `mergeSkillLists()` 合并 headless/fs 数据。

### 数据采��层（Collectors）

数据采集诊断逻辑参考 `docs/architecture/003-diagnosis-principles.md`

- `src/collectors/fs-collector.ts` — `scanFilesystem(adapter)` 扫描 `~/.codebuddy/` 目录，返回 `FsCollectResult`（MCP 列表、Skill 列表、插件、Hooks、Rules、CODEBUDDY.md、历史文件、配置文件摘要）。Skill 扫描覆盖 user/project/marketplace/commands 四种来源。Commands 作为类 skill 条目统计（与 `/context` 展示逻辑一致）。检测重复 skill（标记 `duplicateSource`）和 MCP CLI 替代（标记 `hasCliAlternative`）
- `src/collectors/headless-collector.ts` — `probe(adapter, prompt, schema)` 调用 `codebuddy -p --json-schema` 获取 AI 自报数据。`probeAll()` 支持并行多探针（MCP 列表 + Skill 列表）
- `src/collectors/proxy-collector.ts` — 协调整体 proxy 诊断流程：启动 Proxy → 执行探测命令 → 捕获请求体 → 恢复环境
- `src/collectors/token-estimator.ts` — Token 估算：纯 ASCII 用 `Math.ceil(content.length / 3.3)`，混合 CJK 用 `Math.ceil(ASCII长度 / 3.3) + CJK字符数`，MCP 工具按 200 token/工具。文件影响级别：low（< 1KB）/ medium（1~5KB）/ high（>= 5KB）

### Proxy 层

- `src/proxy/server.ts` — 本地 HTTP 代理服务器，设置 `CODEBUDDY_BASE_URL` 后拦截 `POST /v2/*` 请求，透明转发到真实 API，捕获请求体
- `src/proxy/parser.ts` — 深度解析捕获的请求体 JSON：分解 messages（按 role/block 统计）、分类 tools（内置/MCP/延迟加载）、提取 skills/MCP/rules 引用、Token 估算

### 分析层（Analyzers）

- `src/analyzers/rules.ts` — 规则数据：5 个工具的安装命令/验证命令/配置命令/预估节省、阈值常量（MCP 数警告=5、Skill 数警告=10、CODEBUDDY.md 行数警告=200、历史文件大小警告=50MB）
- `src/analyzers/suggestion-engine.ts` — `generateSuggestions(report)` 遍历诊断报告，对未安装的工具建议安装、对可替换的 MCP 建议禁用、对低频插件/过多 Skill/超大 CODEBUDDY.md 等给出配置优化建议

### 执行层（Executors）

- `src/executors/tool-installer.ts` — `installTool(toolId)` 通过 `tinyexec` 执行安装命令，支持 install → verify → config 三步流程
- `src/executors/codebuddy-configurator.ts` — `applyConfigChange(suggestion)` 根据 actionType 操作 `~/.codebuddy/.mcp.json`（禁用 MCP/设置 defer_loading）和 `settings.json`（禁用插件/设置 deferToolLoading）
- `src/executors/backup-manager.ts` — 优化前备份 MCP/Settings/CODEBUDDY.md 到 `.st-backup-*.json`，支持列表/按时间戳恢复/恢复最新
- `src/executors/diff-generator.ts` — diff 生成

### 工具层（Utils）

- `src/utils/platform.ts` — 平台检测（windows/macos/linux/Termux）、`commandExists()`、`getCodebuddyDir()` 等
- `src/utils/fs-operations.ts` — 同步文件操作封装（read/write/copy/remove/ensureDir），所有操作包裹 `FileSystemError`
- `src/utils/output.ts` — 格式化输出：`printDiagnosisReport()`、`printOptimizePreview()`、`printSuggestions()`，支持 terminal/json/md 三种格式
- `src/utils/debug-logger.ts` — 基于 `debug` 库的调试日志，输出到 `save-token-resource/debug.log`
- `src/utils/error-handler.ts` — `handleExitPromptError()` 和 `handleGeneralError()` 统一错误处理
- `src/utils/prompt-templates.ts` — `codebuddy -p` 探针的中文 prompt 模板和 JSON Schema（MCP 列表、Skill 列表、上下文占用、工具列表）

### 类型定义

- `src/types/index.ts` — 所有核心类型：`DiagnosisReport`、`OptimizationSuggestion`、`ActionType`、`McpEntry`、`SkillEntry`、`PluginEntry`、`HookEntry`、`RuleEntry`、`ConfigFileSummary`、`ToolDetection`、`ContextItem`、`BackupRecord`、`ProxyToolDef`、`ProxyMessageBlock` 等。还包含 `MCP_CLI_ALTERNATIVES` 和 `LOW_FREQUENCY_PLUGINS` 两组运行时映射表

### 国际化

- `src/i18n/index.ts` — 基于 `i18next` + `i18next-fs-backend`，命名空间 `common` / `errors`，支持 `zh-CN` / `en`。构建时通过 `build.config.ts` 的 hook 将 JSON 文件复制到 `dist/i18n/`

## 关键设计约定

- **入口文件**：构建入口是 `src/cli`（`build.config.ts` 中 `entries: ['src/cli']`），输出到 `dist/cli.mjs`
- **二进制命令**：`st` 指向 `bin/st.mjs`，该文件在 dist 中
- **配置路径**：所有 CodeBuddy 配置路径硬编码在 `CodeBuddyAdapter.getConfigPaths()` 中，基于 `~/.codebuddy`
- **三层降级采集**：`st diagnose` 优先用 Proxy 拦截获取实际请求体（最精确），失败则用 headless 探针让 AI 自报，再失败用文件系统扫描保底。`dataSource` 字段标记最终使用的数据来源（`'proxy'` / `'headless'` / `'fs-only'`）
- **不逆向内部格式**：所有数据通过公开接口获取（文件系统 + `codebuddy -p` + Proxy 拦截），不解析 CodeBuddy 内部数据结构或通信协议
- **Token 估算**：纯 ASCII 用 `content.length / 3.3`，混合 CJK 用 `Math.ceil(ASCII长度 / 3.3) + CJK字符数`，MCP 按 200 token/工具。Tools 定义是 Token 消耗最大单项（实测 23 个内置工具约 20K tokens，占总量 ~64%）
- **优化前备份**：所有 `st optimize --apply` 操作在执行前会自动备份被修改的配置文件
- **路径别名**：`@` → `./src`（vitest.config.ts 和测试中使用）
- **settings.json 不计入 Token**：settings.json 是 CodeBuddy 自消费配置，不发送给 LLM API
- **Debug 日志**：通过 `debug` 库实现。设置 `ST_DEBUG=1` 或 `DEBUG=st:*` 或在命令后加 `--debug` 开启。日志写入 `save-token-resource/debug.log`。代码中使用 `import { createLogger } from '../utils/debug-logger'` 创建带命名空间的 logger
