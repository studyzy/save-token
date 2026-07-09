---
name: st-diagnose
description: 'Token 占用诊断。当用户想了解 CodeBuddy Token 占用情况、诊断环境配置、查看 MCP/Skill/Plugin/Rules/CODEBUDDY.md 的 Token 消耗时使用。'
allowed-tools: Read, Write, Bash, AskUserQuestion
---

# st-diagnose: Token 占用诊断

调用 `st diagnose` CLI 命令诊断当前 CodeBuddy 环境的 Token 占用情况，向用户呈现结构化的诊断报告。

## 工作流

### 步骤 1: 检测 st 命令

执行以下命令检测 `st` 是否已安装：

```bash
which st || echo "NOT_FOUND"
```

**如果输出 `NOT_FOUND`**：向用户报告：

```
st CLI 工具未安��。请执行以下命令安装：

  npm install -g save-token

安装后重新运行诊断。或访问 https://github.com/studyzy/save-token 获取更多信息。
```

停止执行。

### 步骤 2: 执行诊断

执行诊断命令，使用 JSON 格式输出以便解析：

```bash
st diagnose --format json
```

**参数说明**:

- `--format json`: 输出结构化 JSON，供后续解析
- 如需跳过 headless 探针（仅文件扫描），追加 `--no-headless`

### 步骤 3: 解析诊断结果

解析 JSON 输出。关键字段：

- `dataSource`: 数据来源（`proxy` 最精确, `headless` 次之, `fs-only` 保底）
- `scanTimestamp`: 采集时间戳
- `contextOverview.totalEstimatedTokens`: 总 Token 估算
- `contextOverview.breakdown[]`: Token 分布明细（按类别）
- `mcpList[]`: MCP 工具列表及 Token 估算
- `skillList[]`: Skill 列表
- `pluginList[]`: Plugin 列表
- `configFiles[]`: 配置文件摘要
- `toolDetection[]`: 已安装省 Token 工具检测
- `warnings[]`: 潜在问题警告

### 步骤 4: 格式化呈现

向用户展示结构化的诊断报告：

1. **总览**: Token 总占用 + 数据来源 + 采集时间
2. **Token 分布**: 按类别展示占用情况（MCP / Skill / Plugin / Rules / CODEBUDDY.md / History），突出高占用项
3. **MCP 列表**: 每个 MCP 的名称、状态、工具数、Token 估算
4. **Skill 列表**: Skill 数量和来源（user/project/marketplace），标注重复 Skill
5. **Plugin 列表**: 已安装插件
6. **配置文件**: CODEBUDDY.md 大小、settings.json、历史文件大小
7. **工具检测**: 已安装的省 Token 工具状态（rtk/caveman/headroom/lean-ctx/graphify）
8. **警告**: 展示 `warnings[]` 中的潜在问题

## 异常处理

### st diagnose 执行失败

如果 `st diagnose` 返回非零退出码或 JSON 解析失败：

1. 展示原始错误输出
2. 说明可能的原因（如 headless 探针不可用）
3. 建议使用 `st diagnose --no-headless` 重试（仅文件扫描）
4. 如果 `--no-headless` 也失败，建议检查 st CLI 版本：`st --version`

### JSON 输出解析失败

如果 stdout 不是有效 JSON：

1. 展示原始输出
2. 说明解析失败
3. 建议检查 st CLI 版本

## 输出示例

诊断完成后，使用以下结构向用户呈现：

```
## Token 占用诊断报告

**数据来源**: proxy（最精确）
**采集时间**: 2026-07-09 10:00:00
**总 Token 估算**: 31,200 tokens

### Token 分布
- MCP 工具定义: 15,000 tokens (48%)
- Skill 定义: 5,000 tokens (16%)
- Rules: 3,200 tokens (10%)
- CODEBUDDY.md: 2,800 tokens (9%)
- Plugin 定义: 2,000 tokens (6%)
- 历史文件: 1,200 tokens (4%)
- 其他: 2,000 tokens (7%)

### MCP 列表
| 名称 | 状态 | 工具数 | Token 估算 |
|------|------|--------|------------|
| headroom | enabled | 4 | ~800 |
| cnb | enabled | 12 | ~2,400 |
| tdesign | enabled | 8 | ~1,600 |
...

### 工具检测
- rtk: 未安装
- caveman: 未安装
- headroom: 已安装 ✓

### 警告
- MCP 工具数量较多（5 个），建议检查是否有低频使用的工具
- CODEBUDDY.md 文件较大（350 行），建议精简
```
