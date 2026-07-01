# CLI 命令契约: Token 优化器

**分支**: `001-token-optimizer` | **日期**: 2026-07-01

工具名：`st`（save-token 缩写）

## 命令总览

| 命令 | 用途 | 默认行为 |
| --- | --- | --- |
| `st diagnose` | 扫描 CodeBuddy 环境 | 终端彩色输出 |
| `st analyze` | 生成优化建议 | 基于上次诊断或重新诊断 |
| `st optimize` | 执行优化操作 | dry-run，仅展示 |
| `st rollback` | 回滚优化操作 | 恢复最近一次备份 |
| `st report` | 导出报告 | Markdown 到当前目录 |
| `st --help` / `st -h` | 帮助 | 显示所有命令 |
| `st --version` / `st -v` | 版本 | 显示版本号 |

---

## st diagnose

扫描 CodeBuddy 环境并输出诊断报告。

```
st diagnose [--format <terminal|json|md>] [--no-headless] [--report <path>]
```

**选项**:
- `--format <terminal|json|md>` — 输出格式，默认 `terminal`
- `--no-headless` — 跳过 `codebuddy -p` 调用，仅文件系统扫描
- `--report <path>` — 同时将报告写入文件

**退出码**:
- `0` — 成功
- `1` — codebuddy 未安装且未指定 `--no-headless`
- `2` — 配置文件解析失败（语法错误）
- `3` — 未知错误

**输出（terminal 格式）**:
```
CodeBuddy Token 诊断报告
========================
扫描时间: 2026-07-01 18:00:00
CodeBuddy 版本: 2.114.1
平台: macOS

上下文总览（估算）
------------------
总估算 Token: 45,230

按占用降序:
1. System tools       16,400  (36%)
2. Skill 定义         12,850  (28%)
3. Memory files        5,200  (12%)
4. MCP 工具定义        4,800  (11%)
5. System prompt       2,100   (5%)
6. Hooks               1,880   (4%)

MCP 服务 (3 个启用)
------------------
✓ headroom    [stdio]  tools: 3  defer: false  ~1,200 tok
✓ serena      [stdio]  tools: 12 defer: false  ~2,400 tok
✓ playwright  [stdio]  tools: 8  defer: false  ~1,600 tok
  (CLI 替代: playwright CLI)

Skills (15 个加载)
-----------------
[project]  release        1,100 tok
[project]  gen-drawio       846 tok
[user]     codebase-memory  730 tok
[plugin]   sop.init         520 tok
...

插件 (12 个启用)
---------------
✓ caveman@caveman
✓ claude-hud@claude-hud
✓ pdf@codebuddy-plugins-official
...

Hooks (4 个)
-----------
PreToolUse [Bash]       → rtk hook codebuddy
PreToolUse [Grep|Glob]  → ~/.codebuddy/hooks/cbm-code-discovery-gate (5s)
...

配置文件
--------
~/.codebuddy/CODEBUDDY.md      2,344 B  62 行  ~586 tok  [中]
~/.codebuddy/settings.json    5,832 B  180 行  ~1,458 tok  [高]
~/.codebuddy/.mcp.json          412 B  25 行  ~103 tok  [低]
...

第三方工具检测
--------------
✗ RTK        未安装  (建议: 节省 ~89% 命令输出)
✓ Caveman    已安装  已集成 codebuddy
✗ Headroom   未安装  (建议: 节省 47-92%)
✗ lean-ctx   未安装
✗ Graphify   未安装

警告
----
- codebuddy -p 调用超时，运行时数据不可用（仅文件扫描）
```

**输出（json 格式）**: `DiagnosisReport` 对象（见 data-model.md）

**输出（md 格式）**: 同 terminal 但用 Markdown 表格

---

## st analyze

基于诊断数据生成优化建议。

```
st analyze [--format <terminal|json|md>] [--report <path>] [--no-headless]
```

**选项**:
- `--format <terminal|json|md>` — 输出格式
- `--report <path>` — 写入文件
- `--no-headless` — 诊断阶段跳过 codebuddy -p

**行为**:
- 若上次诊断报告存在（内存或临时文件），复用；否则自动运行 `diagnose`
- 生成 `OptimizationSuggestion[]`，按 `estimatedSavingTokens` 降序

**退出码**: `0` 成功 / `1` 诊断失败 / `3` 未知

**输出（terminal 格式）**:
```
优化建议报告
============
预估总节省: 18,450 Token (41%)

[1] 安装 RTK ★★★★★
    类型: 安装工具
    预估节省: 8,900 tok (20%)
    风险: 低  可逆: 是
    原因: 终端命令输出压缩 89%，测试/git/搜索高频场景
    动作: brew install rtk && rtk init -g --agent codebuddy

[2] 启用 MCP defer_loading: serena ★★★★
    类型: 配置修改
    预估节省: 2,400 tok (5%)
    风险: 低  可逆: 是
    原因: serena 12 个工具常驻，低频使用
    动作: 修改 ~/.codebuddy/.mcp.json

...
```

**输出（json）**: `{ suggestions: OptimizationSuggestion[], totalEstimatedSaving: number, totalPercent: number }`

---

## st optimize

执行优化操作（安装工具 + 修改配置）。

```
st optimize [--tool <id>] [--apply] [--yes] [--dry-run] [--suggestion <id>]
```

**选项**:
- `--tool <id>` — 只安装指定工具（rtk/caveman/headroom/lean-ctx/graphify）
- `--apply` — 真实执行（默认 dry-run）
- `--yes` — 跳过确认（非交互）
- `--dry-run` — 仅展示 diff（默认）
- `--suggestion <id>` — 只执行指定建议（来自 analyze 的 suggestion.id）

**默认行为（无 `--apply`）**:
- 运行 `analyze` 生成建议
- 展示每条建议的 before/after diff
- 提示用户确认后才能 `--apply`

**`--apply` 行为**:
1. 检测 `~/.codebuddy/.st.lock`，存在则拒绝并发执行
2. 对每条建议：
   - 备份目标文件到 `<file>.bak.<timestamp>`
   - 执行操作（安装命令 / 修改配置）
   - 记录 `ToolInstallResult` / `ConfigChange`
3. 输出汇总
4. 写入 `~/.codebuddy/.st-backup-<timestamp>.json`（BackupRecord）

**退出码**:
- `0` — 成功
- `1` — 部分失败（输出失败项）
- `2` — 锁文件存在（并发拒绝）
- `3` — 未知

**输出**:
```
优化执行（dry-run）
===================
将执行 5 项操作：

[1] 安装 RTK
    $ brew install rtk
    $ rtk init -g --agent codebuddy
    预计修改: ~/.codebuddy/settings.json (添加 hook)
    备份: ~/.codebuddy/settings.json.bak.20260701180000

[2] 启用 serena defer_loading
    文件: ~/.codebuddy/.mcp.json
    --- before
    "serena": { "command": "serena", ... }
    +++ after
    "serena": { "command": "serena", ..., "defer_loading": true }
    备份: ~/.codebuddy/.mcp.json.bak.20260701180000

...
运行 `st optimize --apply` 执行
```

---

## st rollback

从备份恢复。

```
st rollback [--to <timestamp>]
```

**选项**:
- `--to <timestamp>` — 恢复到指定时间戳的备份（默认最近一次）

**行为**:
- 读取 `~/.codebuddy/.st-backup-*.json` 列表
- 无 `--to` 则选最新
- 展示将恢复的文件列表，确认后恢复
- 恢复后保留备份文件（不删除）

**退出码**: `0` 成功 / `1` 无备份 / `2` 指定时间戳不存在

---

## st report

导出诊断+建议报告。

```
st report [--format <md|json>] [--output <path>]
```

**选项**:
- `--format <md|json>` — 默认 `md`
- `--output <path>` — 默认 `./st-report-{timestamp}.md`

**行为**:
- 若无诊断数据，自动运行 `diagnose + analyze`
- 合并为完整报告

**退出码**: `0` 成功 / `1` 诊断失败

---

## 全局选项

- `--lang <zh-CN|en>` — 界面语言（默认系统语言或 CodeBuddy settings.json 的 language）
- `--verbose` — 详细日志
- `--help` / `-h` — 帮助
- `--version` / `-v` — 版本

## 错误处理约定

- 所有命令错误先备份再操作，失败时自动回滚已执行部分
- 错误消息用中文（跟随 `--lang`）
- JSON 格式输出时，错误也返回 JSON：`{ error: string, code: number }`
- 退出码非 0 时 stderr 输出错误详情
