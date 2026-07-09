## ADDED Requirements

### Requirement: 交互式场景问答

系统 SHALL 在 `st analyze` 执行时通过交互式问答收集用户的使用场景，并将结果写入 `DiagnosisReport.scenario` 字段。非交互模式下跳过问答，默认场景为 `general`。

#### Scenario: 交互模式下问答成功

- **WHEN** 用户在终端执行 `st analyze`（未指定 `--format json`）
- **THEN** 系统显示一个选择题："你的 CodeBuddy 主要用于什么场景？"（选项：代码开发/文档写作/通用）
- **THEN** 系统将用户选择写入 `DiagnosisReport.scenario`

#### Scenario: 非交互模式跳过问答

- **WHEN** 用户执行 `st analyze --format json`
- **THEN** 系统跳过交互式问答
- **THEN** scenario 默认值为 `general`

### Requirement: 项目目录自动扫描

系统 SHALL 在 `st analyze` 执行时自动扫描当前工作目录，统计代码文件和文档文件数量，并将结果写入 `DiagnosisReport.projectProfile` 字段。

#### Scenario: 扫描当前目录

- **WHEN** `st analyze` 执行
- **THEN** 系统扫描当前目录，统计代码文件数（.ts/.js/.py/.go/.rs/.java/.rb/.c/.cpp/.h/.vue/.svelte/.swift/.kt）和文档文件数（.md/.mdx/.rst/.txt/.adoc/.wiki）
- **THEN** 系统排除 `node_modules` 和 `.git` 目录
- **THEN** 扫描结果写入 `DiagnosisReport.projectProfile`（含 `codeFileCount`、`docFileCount`、`isLargeCodebase`、`hasLargeDocs`）

#### Scenario: 大代码量判定

- **WHEN** `codeFileCount > 100`
- **THEN** `isLargeCodebase` 为 `true`

#### Scenario: 大量文档判定

- **WHEN** `docFileCount > 50`
- **THEN** `hasLargeDocs` 为 `true`

### Requirement: 硬编码工具推荐

系统 SHALL 根据 `DiagnosisReport.scenario` 和 `DiagnosisReport.projectProfile` 使用硬编码规则生成工具安装建议。

#### Scenario: coding 场景推荐 Ponytail + Caveman

- **WHEN** scenario 为 `coding`
- **THEN** 建议中 SHALL 包含 Ponytail 和 Caveman 的安装推荐（如未安装）

#### Scenario: docs 场景不推荐 Ponytail + Caveman

- **WHEN** scenario 为 `docs`
- **THEN** 建议中 SHALL NOT 包含 Ponytail 和 Caveman 的安装推荐

#### Scenario: 大代码量项目推荐 Graphify

- **WHEN** `projectProfile.isLargeCodebase` 为 `true` 且 scenario 为 `coding` 或 `general`
- **THEN** 建议中 SHALL 包含 Graphify 的安装推荐（如未安装）

#### Scenario: 大代码量+大量文档项目推荐代码知识库 MCP

- **WHEN** `projectProfile.isLargeCodebase` 为 `true` 且 `projectProfile.hasLargeDocs` 为 `true` 且 scenario 为 `coding` 或 `general`
- **THEN** 建议中 SHALL 包含至少一个代码知识库 MCP 的推荐（Codebase-memory-mcp/GitNexus/CodeGraph）

### Requirement: LLM 驱动的移除建议

系统 SHALL 调用 `codebuddy -p` 让 LLM 分析诊断报告中的 Skill、MCP、Agent、Plugin、Hook 列表，根据场景和项目特征生成移除/禁用建议。

#### Scenario: 调用 LLM 生成移除建议

- **WHEN** `st analyze` 完成 diagnose 并生成工具安装建议后
- **THEN** 系统 SHALL 调用 `codebuddy -p --output-format json --json-schema` 传入诊断报告摘要（Skill/MCP/Agent/Plugin/Hook 列表）、场景和项目特征
- **THEN** 系统 SHALL 解析 LLM 返回的 JSON 数组，转换为 `OptimizationSuggestion[]`
- **THEN** 系统 SHALL 将 LLM 建议与硬编码工具建议合并

#### Scenario: LLM 调用失败回退

- **WHEN** `codebuddy -p` 调用失败（网络错误/未登录/超时）
- **THEN** 系统 SHALL 回退到硬编码规则：按场景关键词过滤 Skill 和 Plugin
- **THEN** 系统 SHALL 输出警告提示 LLM 分析不可用

### Requirement: 场景类型定义

系统 SHALL 支持以下场景类型：`coding`、`docs`、`general`。类型定义位于 `src/types/index.ts` 的 `UsageScenario` 类型中。

#### Scenario: 场景枚举完整性

- **WHEN** 任何组件使用 `UsageScenario` 类型
- **THEN** 可选值为 `coding | docs | general`
