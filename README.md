# save-token

> CodeBuddy Token 占用诊断与优化工具

通过文件系统扫描 + `codebuddy -p` 无头模式自报，诊断 CodeBuddy 环境的 Token 占用，生成优化建议，并自动安装省 Token 工具（RTK、Caveman、Headroom、lean-ctx、Graphify）+ 优化 CodeBuddy 配置（禁用 MCP/插件、启用 defer_loading）。

## 快速开始

```bash
# 安装
pnpm add -g save-token

# 诊断
st diagnose

# 生成建议
st analyze

# 执行优化（默认 dry-run）
st optimize --dry-run
st optimize --apply
```

## 核心概念

- **诊断（diagnose）**: 扫描 `~/.codebuddy/` 配置文件 + 调用 `codebuddy -p` 自报 MCP/Skill/Tool 列表，估算 Token 占用
- **分析（analyze）**: 基于诊断数据按规则表生成 12 类优化建议
- **优化（optimize）**: 默认 dry-run 展示 diff，`--apply` 真实执行（安装工具 + 修改配置，改前必备份）
- **回滚（rollback）**: 从备份恢复
- **报告（report）**: 导出完整 Markdown/JSON 报告

## 命令

| 命令 | 用途 |
| --- | --- |
| `st diagnose` | 扫描 CodeBuddy 环境 |
| `st analyze` | 生成优化建议 |
| `st optimize [--apply]` | 执行优化（dry-run 默认） |
| `st rollback` | 从备份恢复 |
| `st report` | 导出报告 |

## 输出格式

所有命令支持 `--format terminal|json|md`。

## 贡献指南

- TypeScript strict 模式，ESLint 零 warning
- 测试覆盖率 ≥ 60%
- Conventional Commits 格式提交
- 中文文档，英文注释

## License

MIT
