---
name: st-analyze
description: 'Token 优化分析。当用户想要优化建议、分析 Token 浪费、了解如何减少 Token 占用、获取个性化优化方案时使用。'
allowed-tools: Read, Write, Bash, AskUserQuestion
---

# st-analyze: Token 优化分析

收集用户的使用场景和项目上下文，结合 `st diagnose` 诊断数据，生成个性化的 Token 优化建议��

## 工作流

### 步骤 1: 检查诊断数据是否可用

首先尝试读取已有的诊断结果文件：

```bash
cat save-token-resource/diagnosis-report.json 2>/dev/null || echo "NOT_FOUND"
```

**如果文件存在**且 `scanTimestamp` 在 5 分钟内：复用诊断结果，跳到步骤 3。

**如果文件不存在或已过期**：执行诊断：

```bash
st diagnose --format json --report save-token-resource/diagnosis-report.json
```

### 步骤 2: 收集使用场景信息

使用 `AskUserQuestion` 工具向用户收集以下信息。**不要猜测，必须询问用户**。

**问题 1: 主要使用场景**

```
请选择您最常使用 CodeBuddy 的场景：
```

选项：

- 日常编码（编写功能代码、修 Bug）
- 代码审查（Review PR、检查代码质量）
- 架构设计（系统设计、技术方案讨论）
- 全栈开发（前后端都涉及）
- 通用（没有特定场景）

**问题 2: 项目类型**

```
您当前项目的类型是？
```

选项：

- 前端（Web/移动端 UI 开发）
- 后端（API 服务、数据处理）
- 全栈（前后端都涉及）
- 工具/库（CLI 工具、SDK、框架）
- 其他

**问题 3: 技术栈**（可选，允许跳过）

```
您当前项目使用的主要技术栈是什么？（可选，可跳过）
```

允许用户自由文本输入，如 "React + Node.js"、"Go + gRPC"、"Python + FastAPI" 等。

**如果用户跳过场景收集**：使用通用分析模式，不针对特定场景优化建议排序。

### 步骤 3: 读取诊断数据并生成建议

读取诊断 JSON 文件：

```bash
cat save-token-resource/diagnosis-report.json
```

结合收集到的场景信息，分析诊断数据并生成个性化优化建议：

1. **工具安装建议**: 检查 `toolDetection[]`，对未安装的工具根据场景推荐：
   - **全栈/后端开发**（MCP 多）: 优先推荐 `rtk`（Token 过滤，节省 40-60%）
   - **代码审查**: 优先推荐 `caveman`（压缩输出，节省 ~75%）
   - **通用**: 推荐 `headroom`（上下文压缩）+ `lean-ctx`（精简上下文）

2. **MCP 优化建议**: 检查 `mcpList[]`：
   - MCP 数量 > 5: 建议禁用低频 MCP
   - 有 `hasCliAlternative` 标记的 MCP: 建议用 CLI 替代
   - 未设置 `deferLoading` 的 MCP: 建议开启延迟加载

3. **Skill 优化建议**: 检查 `skillList[]`：
   - 有 `duplicateSource` 标记的 Skill: 建议去重
   - Skill 数量 > 10: 建议检查是否有不使用 Skill

4. **配置文件优化建议**: 检查 `configFiles[]`：
   - CODEBUDDY.md > 200 行: 建议精简
   - 历史文件 > 50MB: 建议清理

5. **场景特定建议**: 根据用户场景调整优先级：
   - 日常编码: 优先保证常用 MCP 可用，谨慎禁用
   - 代码审查: 优先启用 caveman 等输出压缩工具
   - 架构设计: 可能需要更多 Skill 支持，仅优化 MCP

### 步骤 4: 格式化呈现

按 Token 节省量从高到低排序展示建议：

```
## Token 优化分析

**使用场景**: 全栈开发
**项目类型**: 全栈
**当前 Token 占用**: 31,200 tokens

### 优化建议（按节省量排序）

| # | 建议 | 类型 | 预计节省 | 风险 |
|---|------|------|----------|------|
| 1 | 安装 rtk - Token 过滤代理 | 安装工具 | ~15,000 tokens (48%) | 低 |
| 2 | 禁用 MCP tdesign - 低频使用 | 配置修改 | ~1,600 tokens (5%) | 低 |
| 3 | 开启 MCP defer_loading - 减少初始 Token | 配置修改 | ~3,000 tokens (10%) | 低 |
| 4 | 精简 CODEBUDDY.md - 当前 350 行 | 配置修改 | ~1,500 tokens (5%) | 低 |

**总预计节省**: ~21,100 tokens (68%)

### 场景分析

作为全栈开发者，您需要多种 MCP 工具。建议保留常用的后端/前端 MCP，禁用低频工具。
rtk 是最重要的优化——它可以在发送给 LLM 前过滤掉不必要的 Token，节省约 48%。

如需应用这些优化，请说"应用优化"。
```

### 无需优化的情况

如果诊断数据显示 Token 占用已在合理范围内（总占用 < 15,000 tokens，MCP < 5 个，CODEBUDDY.md < 200 行，无工具可安装）：

```
## Token 优化分析

**使用场景**: {场景}
**当前 Token 占用**: {数值} tokens

当前 Token 占用合理，无需优化。

### 已就绪
- MCP 工具数: {数量}（合理）
- CODEBUDDY.md: {行数} 行（合理）
- 省 Token 工具: {已安装列表}

当前配置已适合您的使用场景。
```
