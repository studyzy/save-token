# 任务: Token 优化器 (Token Optimizer)

**输入**: 来自 `/specs/001-token-optimizer/` 的设计文档
**前置条件**: plan.md, spec.md, research.md, data-model.md, contracts/cli-contract.md, quickstart.md

**测试**: 章程要求单元测试覆盖率 ≥ 60%，采用 TDD 优先。

**组织结构**: 任务按用户故事分组，每个故事可独立实施和测试。

## 格式: `[ID] [P?] [Story] 描述`
- **[P]**: 可并行运行（不同文件，无依赖）
- **[Story]**: 用户故事标签（US1/US2/US3）
- 描述含确切文件路径

## 路径约定
单一项目：仓库根目录下的 `src/`, `tests/`

---

## 阶段 1: 设置（共享基础设施）

**目的**: 项目初始化和基本结构

- [X] T001 在 `package.json` 中配置 ESM 项目（type: module, bin: {st: bin/st.mjs}, scripts: dev/build/test/typecheck/lint），参考 ~/Code/zcf/package.json:1-115
- [X] T002 创建 `bin/st.mjs` 极简入口（#!/usr/bin/env node + import ../dist/cli.mjs），参考 zcf bin/zcf.mjs:1-3
- [X] T003 [P] 在 `tsconfig.json` 中配置 strict + ES2022 + moduleResolution:bundler + resolveJsonModule，参考 zcf tsconfig.json:1-33
- [X] T004 [P] 在 `build.config.ts` 中配置 unbuild（entries: src/cli, declaration:true, clean:true），参考 zcf build.config.ts
- [X] T005 [P] 在 `vitest.config.ts` 中配置 globals + setupFiles + coverage threshold 60%，参考 zcf vitest.config.ts
- [X] T006 [P] 在 `eslint.config.ts` 中配置 ESLint 严格规则集
- [X] T007 [P] 在 `.husky/pre-commit` 中配置 lint-staged + commitlint
- [X] T008 安装依赖：`pnpm add cac inquirer inquirer-toggle ansis ora tinyexec pathe dayjs fs-extra semver i18next i18next-fs-backend` + `pnpm add -D unbuild tsx typescript vitest @types/node eslint prettier husky lint-staged @commitlint/cli @commitlint/config-conventional`

**检查点**: 项目骨架就绪，`pnpm dev` 可启动（无命令注册时显示 help）

---

## 阶段 2: 基础（阻塞前置条件）

**目的**: 所有用户故事依赖的核心基础设施

**⚠️ 关键**: 此阶段完成前无法开始用户故事

- [X] T009 [P] 在 `src/types/index.ts` 中定义所有核心类型（DiagnosisReport, McpEntry, SkillEntry, PluginEntry, HookEntry, ToolDetection, OptimizationSuggestion, ToolInstallResult, BackupRecord），见 data-model.md
- [X] T010 [P] 在 `src/utils/error-handler.ts` 中实现 handleExitPromptError + handleGeneralError，参考 zcf error-handler.ts
- [X] T011 [P] 在 `src/utils/fs-operations.ts` 中实现同步 FS 包装（exists/ensureDir/readFile/writeFile/copyFile/getStats/readDir），参考 zcf fs-operations.ts
- [X] T012 [P] 在 `src/utils/platform.ts` 中实现 getPlatform/commandExists/findCommandPath/wrapCommandWithSudo，参考 zcf platform.ts
- [X] T013 [P] 在 `src/i18n/index.ts` 中实现 i18next 初始化 + ensureI18nInitialized 守卫，参考 zcf i18n/index.ts
- [X] T014 [P] 在 `src/i18n/locales/zh-CN/common.json` 和 `src/i18n/locales/en/common.json` 中定义通用翻译（errors/labels/messages）
- [X] T015 [P] 在 `src/utils/output.ts` 中实现彩色终端输出 + JSON 输出 + Markdown 输出格式化（ansis）
- [X] T016 在 `src/cli.ts` + `src/cli-setup.ts` 中注册 cac 命令骨架（5 个命令名 + alias + --help），参考 zcf cli.ts:1-13 + cli-setup.ts:212-341
- [X] T017 [P] 在 `src/adapters/platform-adapter.ts` 中定义 PlatformAdapter 抽象接口（detectInstall/getConfigPaths/getHeadlessCommand/parseHeadlessOutput）
- [X] T018 [P] 在 `src/adapters/codebuddy-adapter.ts` 中实现 CodeBuddyAdapter（配置路径：~/.codebuddy/.mcp.json, settings.json, CODEBUDDY.md, skills/, plugins/marketplaces/）
- [X] T019 [P] 在 `src/adapters/claude-code-adapter.ts` 和 `src/adapters/codex-adapter.ts` 中创建空实现（throw NotImplemented）
- [X] T020 [P] 在 `tests/setup.ts` 中初始化 i18n（en），参考 zcf tests/setup.ts
- [X] T021 [P] 在 `tests/fixtures/` 中创建测试用配置样本（settings.json, .mcp.json, SKILL.md 示例）

**检查点**: 基础就绪，`st --help` 显示 5 个命令，所有类型和工具函数可用

---

## 阶段 3: 用户故事 1 - 一键诊断 CodeBuddy 环境（优先级: P1）🎯 MVP

**目标**: 运行 `st diagnose` 输出完整诊断报告（MCP/Skill/插件/Hook/配置文件/工具检测 + 上下文估算）

**独立测试**: `st diagnose --format json` 输出有效 DiagnosisReport JSON；`--no-headless` 降级为仅文件扫描

### 用户故事 1 的测试

- [X] T022 [P] [US1] 在 `tests/collectors/token-estimator.test.ts` 中测试字符数/4 估算
- [X] T023 [P] [US1] 在 `tests/collectors/fs-collector.test.ts` 中测试配置文件解析（用 fixtures，mock 文件路径）
- [X] T024 [P] [US1] 在 `tests/collectors/headless-collector.test.ts` 中测试 codebuddy -p 调用（vi.mock tinyexec）
- [X] T025 [P] [US1] 在 `tests/commands/diagnose.test.ts` 中测试 diagnose 命令完整流程（mock collectors）

### 用户故事 1 的实施

- [X] T026 [P] [US1] 在 `src/collectors/token-estimator.ts` 中实现 estimate(content) = Math.ceil(length/4)
- [X] T027 [P] [US1] 在 `src/collectors/fs-collector.ts` 中实现文件系统扫描：读 ~/.codebuddy/.mcp.json、settings.json、CODEBUDDY.md、skills/、commands/、rules/、plugins/marketplaces/，返回 McpEntry[]/SkillEntry[]/PluginEntry[]/HookEntry[]/ConfigFileSummary[]，参考 zcf json-config.ts + fs-operations.ts
- [X] T028 [P] [US1] 在 `src/collectors/headless-collector.ts` 中实现 codebuddy -p 调用：probe(prompt, schema) 用 tinyexec.x + timeout 60s + 降级处理，提示词模板见 plan 决策 1
- [X] T029 [P] [US1] 在 `src/utils/prompt-templates.ts` 中定义 MCP_LIST_PROMPT/SKILL_LIST_PROMPT/TOOL_LIST_PROMPT（提示词让 codebuddy 自报结构化 JSON）
- [X] T030 [US1] 在 `src/commands/diagnose.ts` 中实现 diagnose 命令：调用 FsCollector + HeadlessCollector，组装 DiagnosisReport，输出 terminal/json/md 三种格式，错误降级处理（codebuddy 不在 PATH/超时/解析失败）
- [X] T031 [US1] 在 `src/cli-setup.ts` 中注册 diagnose 命令（--format/--no-headless/--report 选项）

**检查点**: `st diagnose` 输出完整诊断报告，`--no-headless` 可降级，JSON 格式可被 jq 解析

---

## 阶段 4: 用户故事 2 - 生成优化建议报告（优先级: P2）

**目标**: 运行 `st analyze` 基于诊断数据生成 12 条规则的建议报告

**独立测试**: `st analyze --format json` 输出 suggestions 数组，每条含 type/target/reason/estimatedSavingTokens/risk/reversible/actionType

### 用户故事 2 的测试

- [X] T032 [P] [US2] 在 `tests/analyzers/rules.test.ts` 中测试规则触发逻辑（MCP→CLI 映射、低频插件、工具检测）
- [X] T033 [P] [US2] 在 `tests/analyzers/suggestion-engine.test.ts` 中测试建议生成（输入 mock DiagnosisReport，断言 suggestions）
- [X] T034 [P] [US2] 在 `tests/commands/analyze.test.ts` 中测试 analyze 命令（mock diagnose + engine）

### 用户故事 2 的实施

- [X] T035 [P] [US2] 在 `src/analyzers/rules.ts` 中定义规则表：5 安装类（RTK/Caveman/Headroom/lean-ctx/Graphify 检测 + 安装命令）+ 5 配置类（MCP>5、MCP 有 CLI 替代、defer_loading 缺失、低频插件、skill>10）+ 2 建议类（CODEBUDDY.md>200 行、history.jsonl>50MB），含 MCP→CLI 映射表（Playwright→playwright、github→gh、slack→slack-cli），低频插件黑名单
- [X] T036 [US2] 在 `src/analyzers/suggestion-engine.ts` 中实现 generateSuggestions(report): OptimizationSuggestion[]，遍历规则表，对每条规则检���触发条件，生成建议（估算节省 token、风险等级、可逆性、actionPayload）
- [X] T037 [US2] 在 `src/commands/analyze.ts` 中实现 analyze 命令：运行 diagnose（或复用缓存）→ generateSuggestions → 输出 terminal/json/md，按 estimatedSavingTokens 降序
- [X] T038 [US2] 在 `src/cli-setup.ts` 中注册 analyze 命令（--format/--report/--no-headless）

**检查点**: `st analyze` 输出建议列表，每条含预估节省 token，JSON 格式可程序化处理

---

## 阶段 5: 用户故事 3 - 执行优化操作（优先级: P3）

**目标**: `st optimize` 默认 dry-run 展示 diff，`--apply` 执行安装工具 + 修改 codebuddy 配置，`st rollback` 恢复

**独立测试**: `st optimize --dry-run` 不修改任何文件；`--apply` 后备份文件存在、配置已修改；`st rollback` 恢复原状

### 用户故事 3 的测试

- [X] T039 [P] [US3] 在 `tests/executors/backup-manager.test.ts` 中测试备份/恢复（mock fs，验证 .bak.timestamp 命名）
- [X] T040 [P] [US3] 在 `tests/executors/tool-installer.test.ts` 中测试工具安装（vi.mock tinyexec，验证 brew/pip/git 命令）
- [X] T041 [P] [US3] 在 `tests/executors/codebuddy-configurator.test.ts` 中测试配置修改（mock 文件，验证 mcpServers→disabledMcpServers 移动、defer_loading 设置、enabledPlugins=false）
- [X] T042 [P] [US3] 在 `tests/executors/diff-generator.test.ts` 中测试 CODEBUDDY.md 精简 diff 生成
- [X] T043 [P] [US3] 在 `tests/commands/optimize.test.ts` 中测试 optimize 命令（dry-run 不改文件，--apply 调用 executors）
- [X] T044 [P] [US3] 在 `tests/commands/rollback.test.ts` 中测试 rollback 命令

### 用户故事 3 的实施

- [X] T045 [P] [US3] 在 `src/executors/backup-manager.ts` 中实现 backup(file) → .bak.{YYYYMMDDHHmmss}、restore(backupPath)、listBackups()，记录 BackupRecord 到 ~/.codebuddy/.st-backup-{timestamp}.json
- [X] T046 [P] [US3] 在 `src/executors/tool-installer.ts` 中实现 install(toolId)：按 ID 分发（rtk:brew+rtk init、caveman:git clone+install.sh、headroom:pip+headroom mcp install、lean-ctx:brew+lean-ctx setup、graphify:uv+graphify install），安装前 commandExists 检测，返回 ToolInstallResult
- [X] T047 [P] [US3] 在 `src/executors/codebuddy-configurator.ts` 中实现配置优化：disableMcp(name) 移到 disabledMcpServers、enableDeferLoading(name) 设置 defer_loading:true、disablePlugin(id) 设 enabledPlugins=false、disableSkill(name) 移到 .disabled/、enableDeferToolLoading() 设 settings.json，每步先 backup
- [X] T048 [P] [US3] 在 `src/executors/diff-generator.ts` 中实现 CODEBUDDY.md 精简 diff 生成（识别冗余段落、输出 unified diff，不写入文件）
- [X] T049 [US3] 在 `src/commands/optimize.ts` 中实现 optimize 命令：运行 analyze → 展示 dry-run diff → --apply 时加锁（~/.codebuddy/.st.lock）→ 逐条执行 → 写 BackupRecord → 解锁，支持 --tool/--yes/--suggestion
- [X] T050 [US3] 在 `src/commands/rollback.ts` 中实现 rollback 命令：读取 BackupRecord 列表 → 选最新或 --to 指定 → 展示将恢复文件 → 确认后恢复
- [X] T051 [US3] 在 `src/cli-setup.ts` 中注册 optimize + rollback 命令

**检查点**: `st optimize --apply` 可安装工具 + 修改配置，备份存在，`st rollback` 完整恢复

---

## 阶段 6: 完善（用户故事 4 - 导出报告 + 横切关注点）

**目的**: `st report` 命令 + 文档 + 测试补全

- [X] T052 [P] 在 `src/commands/report.ts` 中实现 report 命令：合并 diagnose + analyze 输出 Markdown/JSON 到文件（默认 ./st-report-{timestamp}.md）
- [X] T053 [P] 在 `src/cli-setup.ts` 中注册 report 命令
- [X] T054 [P] 在 `tests/commands/report.test.ts` 中测试 report 命令
- [X] T055 [P] 在 `README.md` 中写中文文档（项目简介、快速开始、核心概念、贡献指南），参考 quickstart.md
- [X] T056 [P] 在 `CHANGELOG.md` 中初始化 Keep a Changelog 格式
- [X] T057 [P] 在 `docs/architecture/` 中记录 ADR-001（双层采集架构）和 ADR-002（dry-run 默认 + 备份策略）
- [X] T058 运行 `pnpm test:coverage` 验证覆盖率 ≥ 60%
- [X] T059 运行 `pnpm lint` 和 `pnpm typecheck` 验证零 warning
- [X] T060 运行 quickstart.md 场景验证（diagnose → analyze → optimize --dry-run → rollback）

**检查点**: 所有命令可用，测试覆盖率达标，lint/typecheck 零错误

---

## 依赖关系与执行顺序

### 阶段依赖关系
- **设置（阶段 1）**: 无依赖，立即开始
- **基础（阶段 2）**: 依赖设置完成，阻塞所有用户故事
- **用户故事（阶段 3-5）**: 都依赖基础完成
  - US1 → US2 → US3（US2 依赖 US1 的 DiagnosisReport，US3 依赖 US2 的 suggestions）
- **完善（阶段 6）**: 依赖所有用户故事完成

### 用户故事依赖关系
- **US1（P1）**: 基础完成后可开始，无其他故事依赖
- **US2（P2）**: 依赖 US1 的 DiagnosisReport 输出
- **US3（P3）**: 依赖 US2 的 OptimizationSuggestion 列表

### 每个用户故事内部
- 测试先写（TDD）
- collectors → analyzers → executors（采集 → 分析 → 执行）
- 工具函数 → 命令实现 → cli-setup 注册

### 并行机会
- 阶段 1/2 所有 [P] 任务可并行
- US1 内 T022-T029 测试 + 采集器可并行
- US2 内 T032-T035 测试 + 规则可并行
- US3 内 T039-T048 测试 + executors 可并行
- 阶段 6 所有 [P] 任务可并行

---

## 并行示例: 用户故事 1

```bash
# 并行启动 US1 所有测试:
任务: "tests/collectors/token-estimator.test.ts"
任务: "tests/collectors/fs-collector.test.ts"
任务: "tests/collectors/headless-collector.test.ts"
任务: "tests/commands/diagnose.test.ts"

# 并行启动 US1 所有采集器:
任务: "src/collectors/token-estimator.ts"
任务: "src/collectors/fs-collector.ts"
任务: "src/collectors/headless-collector.ts"
任务: "src/utils/prompt-templates.ts"
```

---

## 实施策略

### MVP（仅用户故事 1）
1. 阶段 1: 设置（T001-T008）
2. 阶段 2: 基础（T009-T021）
3. 阶段 3: US1（T022-T031）
4. **停止验证**: `st diagnose` 可独立交付价值

### 增量交付
1. 设置 + 基础 → 基础就绪
2. US1 → 独立测试 → 交付诊断能力（MVP）
3. US2 → 独立测试 → 交付建议能力
4. US3 → 独立测试 → 交付优化执行能力
5. 完善 → 文档 + 测试补全

---

## 注意事项

- [P] 任务 = 不同文件，无依赖
- [Story] 标签映射到 spec.md 用户故事
- 每个用户故事独立可测试
- TDD: 测试先写，验证失败，再实现
- 每个任务后提交（Conventional Commits）
- 检查点处停止验证
- 避免：模糊任务、同文件冲突、跨故事依赖
- 参考 zcf 源码模式（file:line 引见 research.md）
