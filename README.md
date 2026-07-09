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

| 命令                    | 用途                     |
| ----------------------- | ------------------------ |
| `st diagnose`           | 扫描 CodeBuddy 环境      |
| `st analyze`            | 生成优化建议             |
| `st optimize [--apply]` | 执行优化（dry-run 默认） |
| `st rollback`           | 从备份恢复               |
| `st report`             | 导出报告                 |

## CodeBuddy Plugin 使用

save-token 提供 CodeBuddy Plugin，安装后可在对话中通过自然语言使用：

```bash
# 本地开发测试
codebuddy --plugin-dir /path/to/save-token

# 从市场安装（未来）
/plugin install save-token
```

安装后，三个 Skill 自动可用：

| Skill       | 触发方式                  | 功能                             |
| ----------- | ------------------------- | -------------------------------- |
| st-diagnose | "帮我诊断 token 占用"     | 诊断 Token 占用，展示结构化报告  |
| st-analyze  | "分析我的 token 优化空间" | 收集使用场景，生成个性化优化建议 |
| st-optimize | "应用这些优化"            | 执行优化操作，安装工具/修改配置  |

也可手动调用：`/save-token:diagnose`、`/save-token:analyze`、`/save-token:optimize`

## 输出格式

所有命令支持 `--format terminal|json|md`。

## 贡献指南

- TypeScript strict 模式，ESLint 零 warning
- 测试覆盖率 ≥ 60%
- Conventional Commits 格式提交
- 中文文档，英文注释

## License

MIT
