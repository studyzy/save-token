---
name: st-optimize
description: '应用 Token 优化。当用户想要执行优化、应用建议、安装省 Token 工具、修改 CodeBuddy 配置、一键优化 Token 占用时使用。'
allowed-tools: Read, Write, Bash, AskUserQuestion
---

# st-optimize: 应用 Token 优化

基于分析结果执行优化操作：安装省 Token 工具、修改 CodeBuddy 配置文件。执行前展示变更摘要并获取用户确认，执行后报告结果。

## 工作流

### 步骤 1: 检查前置数据

检查分析是否已完成（诊断报告 + 优化建议）：

```bash
cat save-token-resource/diagnosis-report.json 2>/dev/null || echo "NOT_FOUND"
```

**如果诊断数据不可用**：执行完整的诊断+分析流程：

```bash
st diagnose --format json --report save-token-resource/diagnosis-report.json
```

然后参考 st-analyze Skill 收集场景信息并生成优化建议。

**如果诊断数据可用但尚未分析**：参考 st-analyze Skill 收集场景信息并生成优化建议。

### 步骤 2: 展示变更摘要并获取确认

在应用任何优化之前，**必须**向用户展示将要执行的操作摘要，并使用 `AskUserQuestion` 获取确认。

展示内容：

- 将安装的工具列表及预计节省
- 将修改的配置文件及变更内容
- 将禁用的 MCP/Skill/Plugin
- 总预计 Token 节省量
- 备份说明（所有变更前自动备份）

确认问题：

```
即将执行以下优化操作：

- 安装 rtk: 预计节省 15,000 tokens (48%)
- 禁用 MCP tdesign: 预计节省 1,600 tokens (5%)
- 开启 MCP defer_loading: 预计节省 3,000 tokens (10%)

总预计节省: 19,600 tokens (63%)

优化前会自动备份配置文件到 ~/.codebuddy/.st-backup-*.json。
如需回滚，执行 st rollback。

是否继续应用优化？
```

选项：

- 确认执行（应用全部优化）
- 仅安装工具（跳过配置修改）
- 仅修改配置（跳过工具安装）
- 取消（不执行任何操作）

**如果用户取消**：停止执行，提示用户可随时重新运行。

### 步骤 3: 执行优化

根据用户选择执行相应操作：

**执行全部优化**：

```bash
st optimize --apply --yes
```

**仅安装工具**（以 rtk 为例）：

```bash
st optimize --apply --yes --tool rtk
```

如果有多个工具需要安装，分别执行：

```bash
st optimize --apply --yes --tool rtk
st optimize --apply --yes --tool caveman
```

**仅修改配置**：

```bash
st optimize --apply --yes --suggestion <id>
```

对每个配置修改建议分别执行。

### 步骤 4: 解读输出并报告

逐行解析 `st optimize` 的输出，向用户报告：

1. **成功项**: `✓ 安装 rtk 成功`、`✓ 配置已更新` 等
2. **失败项**: `✗ 禁用 MCP xxx 失败: 原因` 等
3. **备份位置**: `备份已保存至: ~/.codebuddy/.st-backup-20260709T100000.json`
4. **总节省**: `总节省: 约 19,600 tokens (63%)`

报告格式：

```
## 优化执行完成

### 执行结果

| 操作 | 状态 | 详情 |
|------|------|------|
| 安装 rtk | ✓ 成功 | 已安装并验证 |
| 禁用 MCP tdesign | ✓ 成功 | 已从 .mcp.json 禁用 |
| 开启 MCP defer_loading | ✓ 成功 | 已更新配置 |

### 备份
备份文件: ~/.codebuddy/.st-backup-20260709T100000.json

### 总节省
预计节省: 19,600 tokens (63%)

### 建议
配置变更需要重启 CodeBuddy 才能生效。请重启 CodeBuddy 后重新诊断验证效果。

如需回滚，执行: st rollback
```

## 部分失败处理

如果部分操作失败：

```
## 优化执行完成（部分失败）

### 执行结果

| 操作 | 状态 | 详情 |
|------|------|------|
| 安装 rtk | ✓ 成功 | 已安装并验证 |
| 禁用 MCP tdesign | ✗ 失败 | 配置文件不存在 |
| 开启 MCP defer_loading | ✓ 成功 | 已更新配置 |

### 备份
备份文件: ~/.codebuddy/.st-backup-20260709T100000.json

### 失败项处理建议
- **禁用 MCP tdesign 失败**: 配置文件可能已被手动修改。请检查 ~/.codebuddy/.mcp.json 是否包含 tdesign 配置。

如需回滚成功的变更，执行: st rollback
```

**关键原则**：

- 成功的变更保留，不因部分失败而全部回滚
- 每个失败项给出具体原因和排查建议
- 提醒用户备份文件路径和回滚方法
- 建议用户手动处理失败项

## 仅安装工具流程

当用户选择"仅安装工具"时，跳过配置修改步骤。仅执行：

```bash
# 安装所有未安装的省 Token 工具
st optimize --apply --yes --tool rtk
st optimize --apply --yes --tool caveman
st optimize --apply --yes --tool headroom
# ... 按需添加
```

## 仅修改配置流程

当用户选择"仅修改配置"时，跳过工具安装步骤。对每条配置修改建议逐一执行：

```bash
st optimize --apply --yes --suggestion <id>
```

## 无优化可执行

如果诊断结果显示无需优化：

```
## 无需优化

当前 Token 占用已在合理范围内，没有可执行的优化操作。
```
