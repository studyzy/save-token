## Context

`st analyze` 当前流程：diagnose → generateSuggestions → print。suggestions 对所有用户一视同仁。

实际使用中，不同场景需要不同工具：

- 写代码需要 Ponytail + Caveman，写文档不需要
- 大代码量项目需要 Graphify，小项目不需要
- 大量代码+文档的项目需要代码知识库 MCP

场景由用户选择（代码/文档/通用），项目特征（代码量、文档量）由自动扫描判断。

工具推荐（安装类建议）用硬编码规则，因为场景-工具映射是确定的。但 Skill/MCP/Agent/Plugin 的移除建议涉及判断每个条目的用途和与场景的相关性，硬编码规则不够灵活，应该调用 `codebuddy -p` 让 LLM 来分析。

## Goals / Non-Goals

**Goals:**

- `st analyze` 运行时用交互式问答收集使用场景（1 个选择题：代码/文档/通用）
- 自动扫描当前目录统计代码文件和文档文件数量
- 工具推荐（RTK/Caveman/Headroom/Ponytail/Graphify 等）用硬编码规则
- Skill/MCP/Agent/Plugin 移除建议调用 `codebuddy -p` 让 LLM 判断
- LLM 输入：诊断报告摘要 + 场景 + 项目 Profile → 输出：建议移除的条目列表

**Non-Goals:**

- 不修改 diagnose 命令
- 不修改 optimize 命令
- 不让用户回答代码量级（自动扫描）

## Decisions

### 1. 整体流程

```
st analyze
  → 交互式问答（场景）
  → 项目目录扫描（ProjectProfile）
  → diagnose（诊断报告）
  → generateSuggestions（工具安装建议，硬编码规则）
  → callLlmForRemovalAdvice（Skill/MCP/Agent/Plugin 移除建议，LLM 判断）
  → 合并建议 → print
```

### 2. 场景类型定义

```ts
type UsageScenario = 'coding' | 'docs' | 'general'
```

### 3. 项目特征类型定义

```ts
interface ProjectProfile {
  codeFileCount: number
  docFileCount: number
  isLargeCodebase: boolean // codeFileCount > 100
  hasLargeDocs: boolean // docFileCount > 50
}
```

### 4. 硬编码规则：工具推荐映射

| 工具           | coding                                | docs   | general                               |
| -------------- | ------------------------------------- | ------ | ------------------------------------- |
| Ponytail       | 推荐                                  | 不推荐 | 推荐                                  |
| Caveman        | 推荐                                  | 不推荐 | 推荐                                  |
| RTK            | 推荐                                  | 推荐   | 推荐                                  |
| Headroom       | 推荐                                  | 推荐   | 推荐                                  |
| Lean-ctx       | 推荐                                  | 推荐   | 推荐                                  |
| Graphify       | isLargeCodebase 时推荐                | 不推荐 | isLargeCodebase 时推荐                |
| 代码知识库 MCP | isLargeCodebase + hasLargeDocs 时推荐 | 不推荐 | isLargeCodebase + hasLargeDocs 时推荐 |

代码知识库 MCP 包括：Codebase-memory-mcp、GitNexus、CodeGraph。

### 5. LLM 判断：Skill/MCP/Agent/Plugin 移除建议

**决策**: 不硬编码 Skill/Plugin/MCP 的移除规则。调用 `codebuddy -p` 让 LLM 分析。

**输入上下文**（JSON，通过 prompt 传给 codebuddy）:

```json
{
  "scenario": "coding",
  "projectProfile": {
    "codeFileCount": 520,
    "docFileCount": 30,
    "isLargeCodebase": true,
    "hasLargeDocs": false
  },
  "diagnosis": {
    "skills": [
      { "name": "ponytail-review", "source": "plugin-marketplace", "estimatedTokens": 1500 },
      { "name": "caveman-commit", "source": "plugin-marketplace", "estimatedTokens": 800 },
      { "name": "pptx", "source": "plugin-marketplace", "estimatedTokens": 1200 }
    ],
    "mcps": [
      { "name": "playwright", "status": "enabled", "toolsCount": 15, "estimatedTokens": 3000 },
      { "name": "github", "status": "enabled", "toolsCount": 8, "estimatedTokens": 1600 }
    ],
    "plugins": [
      { "id": "pptx@codebuddy-plugins-official", "enabled": true },
      { "id": "caveman@studyzy", "enabled": true }
    ],
    "agents": [
      { "name": "lint-check-fix", "source": "project" },
      { "name": "presentation-curator", "source": "project" }
    ],
    "hooks": [{ "event": "post-tool-use", "matcher": "*", "command": "..." }]
  }
}
```

**Prompt 模板**:

```
你是一个 CodeBuddy 配置优化专家。用户正在使用 CodeBuddy 进行【代码开发】工作。
当前项目有 520 个代码文件，是一个大代码量项目。

以下是诊断工具扫描到的当前配置中的 Skill、MCP、Agent、Plugin、Hook 列表。

请分析哪些条目对【代码开发】场景是不必要的，建议移除/禁用。
对每个建议，说明原因和预估节省的 Token。

输出 JSON 格式：
[{"target": "pptx", "type": "plugin", "reason": "文档类 Plugin，代码开发场景不需要", "estimatedSavingTokens": 1200}]
```

**输出解析**: 解析 LLM 返回的 JSON 数组，转换为 `OptimizationSuggestion[]`。

**容错**: LLM 调用失败时，回退到硬编码规则（按场景关键词过滤 Skill/Plugin）。

### 6. 实现模块

- `src/utils/scenario-prompt.ts` — `askScenario()`，1 个选择题
- `src/utils/project-scanner.ts` — `scanProjectProfile()`，目录扫描
- `src/utils/llm-analyzer.ts` — `callLlmForRemovalAdvice(report, scenario, profile)` 调用 `codebuddy -p` 获取移除建议
- `src/analyzers/suggestion-engine.ts` — 工具推荐（硬编码规则），LLM 移除建议整合
- `src/commands/analyze.ts` — 串联整个流程

### 7. LLM 调用方式

复用 `src/collectors/headless-collector.ts` 中的 `codebuddy -p --json-schema` 模式：

```bash
codebuddy -p "<prompt>" --output-format json --json-schema '<schema>' -y --max-turns 2
```

schema 定义返回格式为 `OptimizationSuggestion[]` 数组。

## Risks / Trade-offs

- [风险] LLM 调用增加 analyze 耗时（~3-10秒）→ 可接受，analyze 本身不是高频操作
- [风险] LLM 调用可能失败（无网络/未登录）→ 回退到硬编码规则
- [风险] LLM 输出格式可能不符合 JSON schema → json-schema 约束 + 解析容错
- [风险] 文件扫描性能 → 限制扫描深度 3 层，排除 node_modules/.git
