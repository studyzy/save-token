---
name: st-analyze
description: 'Token 优化分析。当用户想要优化建议、分析 Token 浪费、了解如何减少 Token 占用、获取个性化优化方案时使用。'
allowed-tools: Read, Write, Bash, AskUserQuestion, Agent
---

# st-analyze: Token 优化分析

收集用户的使用场景和项目上下文，结合 `st diagnose` 诊断数据，通过 6 个并行子 Agent 多维度分析，
生成个性化的 Token 优化方案，输出 OpenSpec 风格的 `tasks.md` 待办清单。

## 工作流

### 步骤 1: 检查诊断数据是否可用

```bash
cat save-token-resource/diagnosis-report.json 2>/dev/null || echo "NOT_FOUND"
```

**文件存在**且 `scanTimestamp` 在 5 分钟内 → 复用，跳到步骤 3。
**不存在或过期** → 执行诊断：

```bash
st diagnose --format json --report save-token-resource/diagnosis-report.json
```

### 步骤 2: 收集使用场景信息

使用 `AskUserQuestion` 收集（不要猜测，必须询问）：

- **问题 1: 主要使用场景** — 日常编码 / 代码审查 / 架构设计 / 全栈开发 / 通用
- **问题 2: 项目类型** — 前端 / 后端 / 全栈 / 工具库 / 其他
- **问题 3: 技术栈**（可选，允许跳过）— 自由文本如 "React + Node.js"

用户跳过 → 使用通用分析模式。

### 步骤 3: 并行启动 6 个子 Agent 分析

使用 `Agent` tool **并行**启动以下 6 个分析子 Agent。每个传入完整上下文：
`diagnosis-report.json` 全文 + 场景 + 项目类型 + 技术栈。

**所有子 Agent 必须严格输出以下统一 JSON 格式**（不要任何额外文字）：

```json
{
  "agent": "<agent 标识>",
  "suggestions": [
    {
      "id": "string",
      "category": "tool-enable|cleanup|model-opt|defer-tools|knowledge-base|mcp-defer",
      "target": "string",
      "action": "string",
      "reason": "string",
      "estimatedSavingTokens": 0,
      "risk": "low|medium|high",
      "reversible": true
    }
  ]
}
```

### 步骤 4: 汇总生成 tasks.md

合并 6 个子 Agent 的 `suggestions`，按 `category` 分组，写入：

```
openspec/changes/<scenario>-advice/tasks.md
```

其中 `<scenario>` 为 `coding` / `docs` / `general` 之一（对应步骤 2 的答案）。

格式见下方「tasks.md 输出格式」。

### 步骤 5: 输出摘要

控制台打印分组摘要（`## 1. 第三方工具启用` ... `## 6. MCP 延迟加载`）+ 总计节省 Token/百分比 + tasks.md 路径。

---

## 子 Agent 定义

每个子 Agent 使用 `Agent(subagent_type="general-purpose", prompt="...")` 启动，prompt 包含对应提示词 + 完整上下文。

### 子 Agent 1: 第三方工具启用分析 (tool-enable-agent)

**提示词**：
分析 `toolDetection[]` 数组。对每个 `installed === true && enabled === false` 的工具，生成启用建议。
参考 `recommendedSaving` 字段评估节省量。重点工具：rtk（终端输出压缩）、caveman（AI 回复压缩）、
headroom（上下文压缩）、ponytail（决策阶梯）、graphify（代码图谱）、lean-ctx（读取筛选）。

**输入**：`toolDetection` + `scenario`
**输出 category**：`tool-enable`
**action 示例**：`启用 RTK（配置 PreToolUse Hook）`

### 子 Agent 2: SKILL/Agent/MCP 精简 (cleanup-agent)

**提示词**：
分析 `skillList[]` / `agentList[]` / `mcpList[]`。结合 `scenario` 识别不必要的条目：

- 与当前场景无关的 Skill（如代码开发场景下的演示/文档类 skill）
- 重复或功能重叠的 Agent
- 低频使用或未引用的 MCP（status=disabled 或 toolsCount 极小且长期未用）
  对每个建议删除的条目，给出明确原因和预估节省 Token。

**输入**：`skillList` + `agentList` + `mcpList` + `scenario`
**输出 category**：`cleanup`
**action 示例**：`删除 skill: presentation`、`禁用 mcp: tdesign`

### 子 Agent 3: 模型优化 (model-opt-agent)

**提示词**：
分析 `skillList[]` / `agentList[]` / 可用 Commands。识别执行简单、重复性高的任务（如 lint 检查、格式修复、
简单查询），建议在其 frontmatter 或配置中指定便宜模型（如 `model: lite`）。
说明哪些任务不需要旗舰模型，切换后可显著降本。

**输入**：`skillList` + `agentList` + `commands` + `projectProfile`
**输出 category**：`model-opt`
**action 示例**：`为 lint-check-fix 指定 model: lite`

### 子 Agent 4: Agent Tools 明确化 (defer-tools-agent)

**提示词**：
分析 `agentList[]` 中每个 Agent 的 Tools 定义。若 Agent 未在 frontmatter/配置中明确声明 `tools`，
或声明了过多 broad tools（如 `*`），建议明确最小必要 Tools 集合，并将其余工具配置为 `defer_loading`
（延迟加载）。说明明确 Tools 可减少每次对话注入的工具定义 Token。

**输入**：`agentList` + `hookList`
**输出 category**：`defer-tools`
**action 示例**：`为 code-reviewer 明确 tools: [Read, Grep, Bash]，其余 defer`

### 子 Agent 5: 知识库推荐 (knowledge-base-agent)

**提示词**：
分析 `projectProfile`（代码文件数、文档文件数、是否大代码量）。当 `isLargeCodebase` 或 `hasLargeDocs` 为真时，
推荐第三方知识库/记忆构建工具（如 Graphiti、Mem0、Zep、codebase-memory），
帮助用户将项目知识沉淀为可检索的记忆，减少每次对话重新读取文件的 Token 消耗。

**输入**：`projectProfile` + `scenario`
**输出 category**：`knowledge-base`
**action 示例**：`安装 Graphiti 知识库构建 MCP`

### 子 Agent 6: MCP 延迟加载 (mcp-defer-agent)

**提示词**：
分析 `mcpList[]`。对每个 `status === "enabled" && deferLoading !== true` 的 MCP，生成延迟加载建议。
说明延迟加载可减少会话初始化的工具定义 Token 注入，仅在首次调用时加载。

**输入**：`mcpList`
**输出 category**：`mcp-defer`
**action 示例**：`配置 mcp: serena 延迟加载`

---

## tasks.md 输出格式

```markdown
# 优化建议：<scenario-label>

## 1. 第三方工具启用

- [ ] 启用 RTK（预估节省 ~8900 Token）
      原因：rtk 已安装但未通过 Hook 启用，终端输出未压缩
- [ ] 启用 Headroom（预估节省 ~6200 Token）
      原因：headroom 已安装但 MCP 未注册

## 2. SKILL/Agent/MCP 精简

- [ ] 删除 skill: presentation（预估节省 ~300 Token）
      原因：当前为代码开发场景，演示类 skill 无意义
- [ ] 禁用 mcp: tdesign（预估节省 ~1600 Token）
      原因：低频使用，可用 CLI 替代

## 3. 模型优化

- [ ] 为 lint-check-fix 指定 model: lite（预估节省 ~20% 成本）
      原因：lint 检查为简单重复任务，无需旗舰模型

## 4. Agent Tools 明确化

- [ ] 为 code-reviewer 明确 tools 并 defer 其余（预估节省 ~2000 Token）
      原因：当前声明 broad tools，每次对话注入过多工具定义

## 5. 知识库推荐

- [ ] 安装 Graphiti 知识库构建 MCP（预估节省 ~5000 Token/会话）
      原因：项目代码量大，知识库可减少重复文件读取

## 6. MCP 延迟加载

- [ ] 配置 mcp: serena 延迟加载（预估节省 ~2000 Token）
      原因：serena 工具数多，延迟加载减少初始化注入

---

总计：预估节省 ~XXXXX Token (XX.X%)
```

每组标题固定为上述 6 个，顺序不变。每条建议一行 `- [ ]` 复选框 + 原因缩进两空格。
总计行放在文件末尾，区别于 OpenSpec 的章节标题（用 `---` 分隔）。
