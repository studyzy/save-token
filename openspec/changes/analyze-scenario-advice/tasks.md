## 1. 类型定义

- [x] 1.1 在 `src/types/index.ts` 新增 `UsageScenario` 类型（`'coding' | 'docs' | 'general'`）
- [x] 1.2 新增 `ProjectProfile` 接口（`codeFileCount`、`docFileCount`、`isLargeCodebase`、`hasLargeDocs`）
- [x] 1.3 在 `DiagnosisReport` 接口新增 `scenario: UsageScenario` 和 `projectProfile: ProjectProfile` 字段

## 2. 场景映射数据

- [x] 2.1 在 `src/analyzers/rules.ts` 新增 `SCENARIO_TOOL_MAP`：场景 → 推荐工具 ID 列表的映射表
- [x] 2.2 新增 `CODE_KNOWLEDGE_MCPS`：代码知识库 MCP 列表（含名称和安装命令）

## 3. 场景问答模块

- [x] 3.1 在 `src/utils/` 新增 `scenario-prompt.ts`：`askScenario()` 函数，用 inquirer 问 1 个选择题（代码/文档/通用），返回 `UsageScenario`
- [x] 3.2 处理非交互模式：直接返回 `'general'`

## 4. 项目目录扫描模块

- [x] 4.1 在 `src/utils/` 新增 `project-scanner.ts`：`scanProjectProfile()` 函数，用 glob 扫描当前目录
- [x] 4.2 统计代码文件数（`.ts/.js/.py/.go/.rs/.java/.rb/.c/.cpp/.h/.vue/.svelte/.swift/.kt`）和文档文件数（`.md/.mdx/.rst/.txt/.adoc/.wiki`）
- [x] 4.3 排除 `node_modules` 和 `.git`
- [x] 4.4 返回 `ProjectProfile`（`isLargeCodebase` = codeFileCount > 100, `hasLargeDocs` = docFileCount > 50）

## 5. LLM 移除建议模块

- [x] 5.1 在 `src/utils/` 新增 `llm-analyzer.ts`：`callLlmForRemovalAdvice(report, scenario, profile)`
- [x] 5.2 构建 prompt：将诊断报告中的 Skill/MCP/Agent/Plugin/Hook 列表 + 场景 + 项目特征传给 LLM
- [x] 5.3 调用 `codebuddy -p --output-format json --json-schema '<schema>' -y --max-turns 2`
- [x] 5.4 定义 JSON Schema 约束 LLM 返回 `OptimizationSuggestion[]` 格式
- [x] 5.5 解析 LLM 返回结果，转换为 `OptimizationSuggestion[]`
- [x] 5.6 容错：LLM 调用失败时回退到硬编码规则（按场景关键词过滤 Skill/Plugin）

## 6. analyze 命令集成

- [x] 6.1 在 `src/commands/analyze.ts` 的 `analyze()` 中，diagnose 前调用 `askScenario()` 和 `scanProjectProfile()`
- [x] 6.2 将 scenario 和 projectProfile 写入 `DiagnosisReport`
- [x] 6.3 将 scenario 和 projectProfile 传递给 `generateSuggestions()`
- [x] 6.4 diagnose 后调用 `callLlmForRemovalAdvice()` 获取 LLM 移除建议
- [x] 6.5 合并硬编码建议 + LLM 建议，排序后输出

## 7. suggestion-engine 场景感知

- [x] 7.1 `generateSuggestions()` 新增 `scenario` 和 `projectProfile` 参数
- [x] 7.2 工具推荐阶段：只推荐 `SCENARIO_TOOL_MAP[scenario]` 中的工具；Graphify 额外检查 `isLargeCodebase`
- [x] 7.3 新增代码知识库 MCP 推荐：当 `isLargeCodebase && hasLargeDocs` 时生成 habit_suggestion
- [x] 7.4 移除旧的硬编码 Skill/Plugin 移除逻辑（由 LLM 接管）

## 8. 验证

- [x] 8.1 运行 `pnpm typecheck` 确保无类型错误
- [x] 8.2 运行 `pnpm lint` 确保无 lint 错误
- [x] 8.3 运行 `pnpm test:run` 确保已有测试通过
- [ ] 8.4 手动测试：`pnpm dev analyze` 验证完整流程（问答 → 扫描 → LLM 建议）
- [ ] 8.5 手动测试：`pnpm dev analyze --format json` 验证非交互模式
