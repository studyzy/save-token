## Why

当前 `st analyze` 只生成一份通用优化建议（安装工具、禁用 MCP/Plugin/Skill），不感知用户的 CodeBuddy 使用场景。不同场景（代码开发 vs 文档写作）需要完全不同的工具和优化策略。代码量、项目特征应自动扫描判断，不应让用户回答。

## What Changes

- `st analyze` 运行时先通过交互式问答收集用户使用场景（代码/文档/通用）
- 自动扫描当前目录，判断项目特征：代码文件数量、文档数量、是否大仓
- 结合场景 + 项目特征过滤工具推荐：
  - 代码场景 → 推荐 Ponytail + Caveman
  - 文档场景 → 不推荐 Ponytail/Caveman
  - 大代码量项目（自动检测）→ 推荐 Graphify
  - 大量代码+文档（自动检测）→ 推荐 Graphify + 代码知识库 MCP
- 基于场景生成针对性的 Skill/MCP/Agent/Plugin 移除建议
- 场景和项目特征写入 `DiagnosisReport`，供 `suggestion-engine` 消费

## Capabilities

### New Capabilities

- `scenario-detection`: 交互式场景问答（inquirer，1 个选择题）+ 项目目录自动扫描（代码文件数、文档文件数）

### Modified Capabilities

<!-- Leave empty — no existing spec-level behavior changes -->

## Impact

- `src/commands/analyze.ts` — 添加场景问答流程 + 项目扫描
- `src/analyzers/suggestion-engine.ts` — 场景感知的过滤逻辑
- `src/types/index.ts` — 新增 `UsageScenario`、`ProjectProfile` 类型，`DiagnosisReport` 新增 `scenario` + `projectProfile` 字段
- `src/analyzers/rules.ts` — 新增场景-工具映射表和代码知识库 MCP 定义
- `src/utils/` — 新增 `scenario-prompt.ts` + `project-scanner.ts`
