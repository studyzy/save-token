# 数据模型: Skill 层

**功能**: st CLI 改造为 SKILL 并封装为 Plugin
**日期**: 2026-07-09

## 实体

### 1. Skill 定义（SKILL.md）

每个 Skill 是 `skills/<name>/SKILL.md` 文件，包含 frontmatter 元数据和正文工作流指令。

| 字段          | 类型   | 必填 | 说明                          |
| ------------- | ------ | ---- | ----------------------------- |
| name          | string | 是   | Skill 标识，kebab-case        |
| description   | string | 是   | AI 匹配描述，含使用场景关键词 |
| allowed-tools | string | 否   | 工具白名单，逗号分隔          |
| license       | string | 否   | 许可证                        |
| compatibility | string | 否   | 依赖声明                      |
| metadata      | object | 否   | 版本等元信息                  |

三个 Skill 定义：

| name        | description                                                                                                      | allowed-tools                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| st-diagnose | Token 占用诊断。当用户想了解 CodeBuddy Token 占用情况、诊断环境配置、查看 MCP/Skill/Plugin 的 Token 消耗时使用。 | Read, Write, Bash, AskUserQuestion |
| st-analyze  | Token 优化分析。当用户想要优化建议、分析 Token 浪费、了解如何减少 Token 占用时使用。                             | Read, Write, Bash, AskUserQuestion |
| st-optimize | 应用 Token 优化。当用户想要执行优化、应用建议、安装省 Token 工具、修改配置时使用。                               | Read, Write, Bash, AskUserQuestion |

### 2. 诊断报告（DiagnosisReport）

CLI 输出 JSON 结构。Skill 层只读取和呈现，不修改。

**来源**: `st diagnose --format json`

**关键字段**（Skill 层关注）:

- `scanTimestamp`: 采集时间戳，用于判断是否复用
- `dataSource`: 数据来源（`'proxy'` / `'headless'` / `'fs-only'`）
- `contextOverview.totalEstimatedTokens`: 总 Token 估算
- `contextOverview.breakdown[]`: Token 分布明细
- `mcpList[]`: MCP 工具列表及估算
- `skillList[]`: Skill 列表
- `pluginList[]`: Plugin 列表
- `configFiles[]`: 配置文件摘要
- `toolDetection[]`: 工具检测结果
- `warnings[]`: 警告信息

### 3. 使用场景（UsageScenario）

Skill 层通过 `AskUserQuestion` 收集，不经过 CLI。

| 字段        | 类型   | 说明                                                                                                               |
| ----------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| scenario    | enum   | `coding`（日常编码）/ `review`（代码审查）/ `architecture`（架构设计）/ `fullstack`（全栈开发）/ `general`（通用） |
| projectType | enum   | `frontend` / `backend` / `fullstack` / `library` / `tool` / `other`                                                |
| techStack   | string | 自由文本，如 "React+Node.js"、"Go+gRPC"                                                                            |

### 4. 分析结果（AnalyzeResult）

Skill 层产物，结合诊断数据 + 场景信息生成。

| 字段               | 类型            | 说明                         |
| ------------------ | --------------- | ---------------------------- |
| report             | DiagnosisReport | 诊断报告引用                 |
| scenario           | UsageScenario   | 使用场景                     |
| suggestions        | Suggestion[]    | 优化建议列表（按节省量降序） |
| totalSavingTokens  | number          | 总预计节省 Token             |
| totalSavingPercent | number          | 总节省百分比                 |

### 5. 优化建议（Suggestion）

CLI 输出 `OptimizationSuggestion` 类型的子集，Skill 层增强展示。

**CLI 原始字段**:

- `id`, `type`, `target`, `reason`, `estimatedSavingTokens`, `estimatedSavingPercent`, `risk`, `reversible`, `actionType`, `actionPayload`

**Skill 层增强**:

- `scenarioRelevance`: 与该使用场景的关联说明（Skill 层添加）

### 6. Plugin 清单（plugin.json）

CodeBuddy Plugin 标准清单文件。

| 字段          | 类型     | 必填 | 说明                                 |
| ------------- | -------- | ---- | ------------------------------------ |
| name          | string   | 是   | `save-token`，插件唯一标识和命名空间 |
| version       | string   | 是   | 语义化版本                           |
| description   | string   | 是   | 插件描述                             |
| author        | object   | 否   | `{ name, email }`                    |
| homepage      | string   | 否   | 项目主页                             |
| repository    | string   | 否   | 仓库地址                             |
| keywords      | string[] | 否   | 搜索关键词                           |
| category      | string   | 否   | 分类                                 |
| skills        | string[] | 否   | 显式声明的 skill 列表                |
| compatibility | string   | 否   | 依赖声明（"需要 st CLI 工具"）       |

## 状态转换

### Skill 触发状态

```
IDLE → TRIGGERED → EXECUTING → COMPLETED
                     │
                     ├─ CLI_NOT_FOUND → 给出安装指引 → COMPLETED
                     └─ CLI_ERROR → 展示错误 → COMPLETED
```

### 诊断结果生命周期

```
NOT_EXISTS → COLLECTING → AVAILABLE (5 分钟内有效) → EXPIRED → 重新 COLLECTING
```

### 优化执行状态

```
ANALYZED → CONFIRMING → EXECUTING → COMPLETED
                │            │
                └─ REJECTED  ├─ PARTIAL_SUCCESS
                             └─ ALL_SUCCESS
```

## 关系

```
Plugin (1) ──< Skill (3)
Skill ──> st CLI (bash 调用)
st-diagnose ──> DiagnosisReport (JSON 文件)
st-analyze ──> DiagnosisReport + UsageScenario ──> AnalyzeResult
st-optimize ──> AnalyzeResult ──> 配置变更 + 工具安装
```
