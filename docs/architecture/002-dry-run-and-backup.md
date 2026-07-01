# ADR-002: dry-run 默认 + 备份策略

**状态**: Accepted
**日期**: 2026-07-01

## 背景

`st optimize` 会修改用户的 CodeBuddy 配置（`~/.codebuddy/.mcp.json`、`settings.json`）和安装工具。直接修改风险高：

- 可能覆盖用户已有配置
- 安装失败留下半成品状态
- 用户误操作不可恢复

## 决策

1. **默认 dry-run**: `st optimize` 不带 `--apply` 时仅展示将执行的 diff，不修改任何文件
2. **`--apply` 才写入**: 必须显式指定才真实执行
3. **修改前必备份**: 修改 `~/.codebuddy/.mcp.json` 或 `settings.json` 前，备份到 `<file>.bak.<YYYYMMDDHHmmss>`
4. **`st rollback` 恢复**: 从最近备份或 `--to <timestamp>` 指定恢复
5. **CODEBUDDY.md 精简只生成 diff，不自动写入**（风险最高，可能删用户重要指令）
6. **并发锁**: `~/.codebuddy/.st.lock` 防止并发执行

## 结果

- 用户可安全预览所有变更
- 误操作可一键回滚
- CODEBUDDY.md 风险隔离
- 符合"简洁性与最小必要代码"章程原则
