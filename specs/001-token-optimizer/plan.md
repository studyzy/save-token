# 实施计划: Token 优化器 (Token Optimizer)

**分支**: `001-token-optimizer` | **日期**: 2026-07-01 | **规范**: [spec.md](./spec.md)
**输入**: 来自 `/specs/001-token-optimizer/spec.md` 的功能规范

## 摘要

构建外部 CLI 工具 `st`，通过**文件系统扫描 + `codebuddy -p` 自报数据**两层采集诊断 CodeBuddy 环境，生成优化建议，并执行两类优化：①自动安装省 token 工具（RTK/Caveman/Headroom/lean-ctx/Graphify）；②优化 CodeBuddy 配置（禁用 MCP/插件/skill、启用 defer_loading/deferToolLoading）。所有修改默认 dry-run，`--apply` 才写入，改前必备份。

## 技术背景

**语言/版本**: TypeScript 5.x, ES2022+, strict 模式
**主要依赖**: cac（CLI 注册）、inquirer + inquirer-toggle（交互）、ansis（彩色）、ora（spinner）、tinyexec（子进程）、pathe（跨平台路径）、dayjs（时间戳）、fs-extra（文件操作）、semver（版本检测）、i18next + i18next-fs-backend（中英文双语）
**存储**: 文件系统（~/.codebuddy/ 读写、备份目录管理）
**测试**: Vitest（globals 模式 + setup.ts 初始化，覆盖率 ≥ 60%）
**目标平台**: macOS / Linux / WSL（CodeBuddy 支持的平台）
**项目类型**: CLI 工具（npm 全局安装或 npx 执行）
**性能目标**: 诊断 < 30 秒（含 codebuddy -p 调用）；优化（不含工具下载）< 60 秒
**约束条件**: 配置修改必须先备份，默认 dry-run，`--apply` 才写入；CODEBUDDY.md 精简生成 diff 不自动写入
**规模/范围**: 单一 CLI 包，5 个命令，~2000 行代码

## 章程检查

| 章程条款 | 检查 | 结果 |
| --- | --- | --- |
| I. 代码质量（英文注释、TS strict、ESLint 零 warning） | 技术栈匹配 | ✅ 通过 |
| II. 测试优先（vitest、覆盖率 ≥ 60%、可独立运行） | vitest 已纳入，测试 mock 全外部依赖 | ✅ 通过 |
| III. 文档规范（中文文档、英文注释、CHANGELOG） | spec/plan/research 中文，代码注释英文 | ✅ 通过 |
| IV. 简洁性（YAGNI、单文件 < 500 行、单函数 < 50 行） | 5 命令分层清晰 | ✅ 通过 |
| V. 版本控制（SemVer、Conventional Commits、PR） | 遵循章程 | ✅ 通过 |
| 附加：TS strict + Node18 + pnpm + ESLint/Prettier + Commitlint | 完全匹配 | ✅ 通过 |

**无违规，无需复杂度��踪。**

## 项目结构

### 文档(此功能)

```
specs/001-token-optimizer/
├── plan.md              # 此文件
├── research.md          # 阶段 0 输出（8 个决策 + zcf 模式清单）
├── data-model.md        # 阶段 1 输出（10 个实体定义）
├── quickstart.md        # 阶段 1 输出（3 步快速开始）
├── contracts/
│   └── cli-contract.md  # 阶段 1 输出（5 个 CLI 命令契约）
└── tasks.md             # 阶段 2 输出（/speckit.tasks 创建）
```

### 源代码(仓库根目录)

```
save-token/
├── bin/
│   └── st.mjs                    # CLI 入口（参考 zcf bin/zcf.mjs:1-3）
├── src/
│   ├── cli.ts                    # cac 命令注册（参考 zcf cli.ts:1-13）
│   ├── cli-setup.ts              # 命令组装（参考 zcf cli-setup.ts:212-341）
│   ├── commands/
│   │   ├── diagnose.ts           # st diagnose
│   │   ├── analyze.ts            # st analyze
│   │   ├── optimize.ts           # st optimize
│   │   ├── rollback.ts           # st rollback
│   │   └── report.ts             # st report
│   ├── collectors/
│   │   ├── headless-collector.ts # codebuddy -p 调用（新设计，zcf 无此模式）
│   │   ├── fs-collector.ts       # 文件系统扫描（参考 zcf fs-operations.ts + json-config.ts）
│   │   └── token-estimator.ts    # 字符数/4 估算
│   ├── analyzers/
│   │   ├── suggestion-engine.ts  # 建议生成
│   │   └── rules.ts              # MCP→CLI 映射、工具安装命令、低频插件规则
│   ├── executors/
│   │   ├── tool-installer.ts     # brew/pip/git clone 封装（参考 zcf installer.ts:505-820）
│   │   ├── codebuddy-configurator.ts # 优化 .mcp.json/settings.json
│   │   ├── backup-manager.ts     # 备份/回滚
│   │   └── diff-generator.ts     # CODEBUDDY.md 精简 diff（不自动写入）
│   ├── adapters/
│   │   ├── platform-adapter.ts   # 抽象接口
│   │   ├── codebuddy-adapter.ts  # CodeBuddy 实现
│   │   ├── claude-code-adapter.ts # 空实现（预留）
│   │   └── codex-adapter.ts      # 空实现（预留）
│   ├── types/
│   │   └── index.ts              # DiagnosisReport / Suggestion / ToolInstallResult 等
│   ├── i18n/
│   │   ├── index.ts              # ensureI18nInitialized 守卫模式
│   │   └── locales/{zh-CN,en}/*.json
│   └── utils/
│       ├── error-handler.ts      # handleExitPromptError / handleGeneralError
│       ├── fs-operations.ts      # 同步 FS 包装
│       ├── platform.ts           # getPlatform / commandExists / wrapCommandWithSudo
│       └── output.ts            # 彩色表格/JSON/Markdown 输出
├── tests/
│   ├── setup.ts                  # i18n 初始化
│   ├── commands/                 # *.test.ts
│   ├── collectors/
│   ├── analyzers/
│   ├── executors/
│   └── fixtures/                 # 测试用配置文件样本
├── package.json                  # type: module, bin: {st: bin/st.mjs}
├── build.config.ts               # unbuild
├── tsconfig.json                 # strict + ES2022
├── vitest.config.ts              # globals + coverage 60% threshold
├── eslint.config.ts
├── .husky/                       # pre-commit lint-staged
└── README.md
```

**结构决策**: 单一项目。参考 zcf 的 `src/commands + src/utils + src/types` 分层，按 save-token 领域调整目录名（collectors/analyzers/executors/adapters）。

## 核心设计决策

### 决策 1: 数据采集双层架构

`HeadlessCollector`（codebuddy -p 自报 MCP/skill/tool 列表）+ `FsCollector`（读文件拿大小/配置）。两层互补。token 用 `Math.ceil(length/4)` 估算。codebuddy -p 失败降级为仅文件扫描。详见 [research.md](./research.md) 决策 1-2。

### 决策 2: 优化执行两类动作

①安装省 token 工具（RTK/Caveman/Headroom/lean-ctx/Graphify，命令见 research.md 决策 8）；②优化 CodeBuddy 配置（禁用 MCP 移到 disabledMcpServers、启用 defer_loading、禁用插件 enabledPlugins=false、禁用 skill 移到 .disabled/、启用 deferToolLoading）。CODEBUDDY.md 精简只生成 diff。详见 plan 决策 2。

### 决策 3: 建议生成规则表

12 条规则（5 安装类 + 5 配置类 + 2 建议类），详见 plan 决策 3 表格。

### 决策 4: PlatformAdapter 接口预留扩展

定义抽象接口，本期仅实现 CodeBuddyAdapter，预留 ClaudeCodeAdapter/CodexAdapter 空实现。

## 测试策略

- **单元测试**（≥ 60% 覆盖率）：token-estimator、rules、backup-manager、fs-collector
- **Mock**：`vi.mock('tinyexec')` 模拟 codebuddy -p 和安装命令；自定义 i18n.t 翻译表；spy process.exit
- **集成测试**：diagnose/optimize 完整流程（mock 外部）
- **不测试**：真实 codebuddy -p（CI 无 codebuddy）

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| codebuddy -p 输出格式变化 | JSON Schema 约束 + 降级原始文本 |
| 工具安装命令变化 | 集中 rules.ts 便于更新 |
| 配置覆盖 | 改前备份 + st rollback |
| CI 无 codebuddy | 测试全 mock |
| token 估算不准 | 标注"估算"，P2 可选接入真实 /context |

## 下一步

阶段 1 完成。运行 `/speckit.tasks` 生成 tasks.md（阶段 2 任务拆解）。
