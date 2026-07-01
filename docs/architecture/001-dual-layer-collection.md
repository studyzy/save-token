# ADR-001: 双层数据采集架构

**状态**: Accepted
**日期**: 2026-07-01

## 背景

需要采集 CodeBuddy 的运行时状态（已加载的 MCP/Skill/Tool）用于诊断 Token 占用。可选方案：

1. 纯文件系统扫描 — 拿不到运行时实际加载列表
2. 纯 `codebuddy -p` 无头模式 — 拿不到文件大小/行数等元信息
3. 提示用户手动 `/context` 粘贴 — 体验差

## 决策

采用双层数据采集：

- **HeadlessCollector**: 调用 `codebuddy -p "<提示词>" --output-format json --json-schema '<schema>' -y --max-turns 2`，让 CodeBuddy 自报 MCP/Skill/Tool 列表
- **FsCollector**: 直接读取 `~/.codebuddy/.mcp.json`、`settings.json`、`CODEBUDDY.md`、`skills/`、`plugins/marketplaces/` 等

两层互补：headless 拿"运行时加载了什么"，fs 拿"配置了什么"。

## 结果

- 采集完整，两层互相补全
- `codebuddy -p` 失败时降级为仅文件扫描，不阻塞诊断
- Token 用 `Math.ceil(content.length / 4)` 估算（实测 `/context` 在无头模式不可执行）

## 备注

实测发现 `codebuddy -p` 无法执行 `/context` 斜杠命令（模型回复"无法执行"）。token 占用分布只能估算。
