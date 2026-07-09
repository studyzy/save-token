# 接口合同: Skill ↔ CLI

**功能**: st CLI 改造为 SKILL 并封装为 Plugin
**日期**: 2026-07-09

## 概述

三个 Skill 通过 `bash` 代码块调用 `st` CLI 子命令。以下是 Skill 与 CLI 之间的调用合同。

## 合同 1: st-diagnose → `st diagnose`

### 调用

```bash
st diagnose --format json [--no-headless] [--report <path>]
```

### 输入

| 参数            | 类型   | 必填 | 说明                               |
| --------------- | ------ | ---- | ---------------------------------- |
| --format json   | flag   | 是   | JSON 格式输出，供 AI 解析          |
| --no-headless   | flag   | 否   | 跳过 headless 探针，仅文件扫描     |
| --report <path> | string | 否   | 同时写入文件（供 st-analyze 复用） |

### 输出

**stdout**: 完整 `DiagnosisReport` JSON 对象。

关键字段：

```json
{
  "scanTimestamp": "2026-07-09T10:00:00Z",
  "dataSource": "proxy" | "headless" | "fs-only",
  "contextOverview": {
    "totalEstimatedTokens": 31200,
    "breakdown": [...]
  },
  "mcpList": [...],
  "skillList": [...],
  "pluginList": [...],
  "hookList": [...],
  "ruleList": [...],
  "configFiles": [...],
  "toolDetection": [...],
  "headlessAvailable": true,
  "warnings": [...]
}
```

**stderr**: 错误信息（如有）。

**退出码**: 0 成功，非 0 失败。

### Skill 层处理

1. 解析 JSON，提取 `totalEstimatedTokens`、`dataSource`、`mcpList`、`skillList`、`warnings`。
2. 格式化为用户可读报告（按类别分组，突出高占用项）。
3. 若 `--report <path>` 已指定，后续 Skill 可读取该文件复用结果。
4. 若退出码非 0，展示错误信息并建议排查。

---

## 合同 2: st-analyze → `st analyze`（可选）

### 调用

```bash
st analyze --format json [--no-headless]
```

### 输入

| 参数          | 类型 | 必填 | 说明          |
| ------------- | ---- | ---- | ------------- |
| --format json | flag | 是   | JSON 格式输出 |

### 输出

**stdout**: JSON 对象：

```json
{
  "report": {/* DiagnosisReport */},
  "suggestions": [/* OptimizationSuggestion[] */],
  "totalSaving": 15000,
  "totalPercent": 48
}
```

### Skill 层处理

`st analyze` CLI 内部已包含场景询问和项目扫描。Skill 层可选择：

- **方案 A**（推荐）：Skill 层自行收集场景信息（更丰富），仅用 `st diagnose` 获取诊断数据，AI 结合场景生成建议。不调用 `st analyze` CLI。
- **方案 B**：直接调用 `st analyze --format json`，AI 解析并呈现建议。场景信息由 CLI 内置的 `askScenario()` 收集。

选择方案 A，因为 Skill 层的场景收集更灵活（可扩展到项目类型、技术栈等维度），且避免 CLI 交互式询问与 Skill 对话流程冲突。

---

## 合同 3: st-optimize → `st optimize`

### 调用

```bash
st optimize --apply --yes [--tool <id>] [--suggestion <id>]
```

### 输入

| 参数              | 类型   | 必填 | 说明                              |
| ----------------- | ------ | ---- | --------------------------------- |
| --apply           | flag   | 是   | 真实执行（否则 dry-run）          |
| --yes             | flag   | 是   | 跳过 CLI 层确认（Skill 层已确认） |
| --tool <id>       | string | 否   | 限定安装某工具                    |
| --suggestion <id> | string | 否   | 限定执行某建议                    |

### 输出

**stdout**: 逐行文本（非 JSON）：

```
✓ 安装 rtk 成功
✗ 禁用 mcp/xxx 失败: 配置文件不存在
备份已保存至: ~/.codebuddy/.st-backup-20260709T100000.json
总节省: 约 15000 tokens (48%)
```

**退出码**: 0 全部成功，非 0 部分或全部失败。

### Skill 层处理

1. 执行前展示变更摘要，用 `AskUserQuestion` 获取用户确认。
2. 执行命令。
3. 解析逐行输出，逐项报告状态。
4. 提取备份路径和总节省量，向用户展示。
5. 建议重启 CodeBuddy 使配置变更生效。

---

## 合同 4: Plugin 安装后行为

### st 命令检测

每个 Skill 在执行前检测 `st` 命令是否存在：

```bash
which st || echo "NOT_FOUND"
```

若返回 `NOT_FOUND`，Skill 输出安装指引：

```
st CLI 工具未安装。请执行：
  npm install -g save-token
或访问 https://github.com/studyzy/save-token 获取安装说明。
```

### Plugin 兼容性声明

`plugin.json` 中声明：

```json
{
  "compatibility": "需要 st CLI 工具。安装: npm install -g save-token"
}
```
