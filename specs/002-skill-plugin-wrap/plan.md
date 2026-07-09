# 实施计划: st CLI 改造为 SKILL 并封装为 Plugin

**分支**: `002-skill-plugin-wrap` | **日期**: 2026-07-09 | **规范**: [spec.md](./spec.md)
**输入**: 来自 `/specs/002-skill-plugin-wrap/spec.md` 的功能规范

## 摘要

将现有 `st` CLI 工具的三个子命令（diagnose、analyze、optimize）封装为三个 CodeBuddy Skill（st-diagnose、st-analyze、st-optimize），并打包为符合 CodeBuddy Plugin 标准的插件包。Skill 通过 `bash` 代码块调用 `st` CLI 命令，解析其 `--json` 输出，由 AI 呈现格式化结果和引导交互。仅使用 Skills（不用 Commands），因为用户通过自然语言触发（"诊断 token"、"分析优化"），而非手动输入斜杠命令。

参考：OpenSpec-cn 的"描述式 CLI 委托"模式——Skill 正文中用 bash 块 + `--json` + "解析字段 X" 指令让 AI 调用 CLI 并消费输出。

## 技术背景

**语言/版本**: TypeScript 5.x (strict), 目标 ES2022+
**主要依赖**: cac (CLI 框架), unbuild (构建), 无需新增依赖
**存储**: 文件系统（诊断结果 JSON, 备份 JSON）
**测试**: Vitest, 覆盖率 >= 60%
**目标平台**: macOS / Linux / Windows (Node.js 18+)
**项目类型**: CLI 工具 + CodeBuddy Plugin
**性能目标**: st diagnose <30s, st analyze <60s
**约束条件**: 不新增 npm 依赖, Skill 文件为纯 Markdown
**规模/范围**: 3 个 SKILL.md + 1 个 plugin.json

## 章程检查

_门控: 必须在阶段 0 研究前通过. 阶段 1 设计后重新检查._

| 原则            | 状态    | 说明                                                                                   |
| --------------- | ------- | -------------------------------------------------------------------------------------- |
| I. 代码质量标准 | ✅ 通过 | Skill 文件为 Markdown（非代码），不涉及 ESLint/TypeScript。plugin.json 为静态 JSON     |
| II. 测试优先    | ✅ 通过 | `st` CLI 已有测试覆盖（>60%）。Skill 层为纯声明式 Markdown，无新代码逻辑，无需新增测试 |
| III. 文档规范   | ✅ 通过 | SKILL.md 本身即为中文文档。如有 ADR 将写入 docs/architecture/                          |
| IV. 简洁性      | ✅ 通过 | 仅创建 4 个新文件（3 个 SKILL.md + 1 个 plugin.json），无新抽象、无新依赖              |
| V. 版本控制     | ✅ 通过 | 在 feature 分支开发，PR 合并到 main                                                    |

**关卡结论**: 全部通过，无违规项。

## 项目结构

### 文档(此功能)

```
specs/002-skill-plugin-wrap/
├── spec.md              # 功能规范
├── plan.md              # 此文件
├── research.md          # 阶段 0 输出
├── data-model.md        # 阶段 1 输出
├── quickstart.md        # 阶段 1 输出
├── contracts/           # 阶段 1 输出
└── tasks.md             # 阶段 2 输出 (/speckit.tasks)
```

### 源代码(仓库根目录)

本次功能仅新增 Plugin 相关文件，不修改现有 `src/` 源码：

```
.codebuddy-plugin/
└── plugin.json                          # Plugin 清单文件

skills/
├── st-diagnose/
│   └── SKILL.md                         # 诊断 Skill
├── st-analyze/
│   └── SKILL.md                         # 分析 Skill
└── st-optimize/
    └── SKILL.md                         # 优化执行 Skill

# 现有结构不变
src/                                     # 现有 CLI 源码
tests/                                   # 现有测试
```

**结构决策**: Plugin 根目录即为仓库根目录。`.codebuddy-plugin/plugin.json` 定义插件元信息，`skills/` 目录包含三个 Skill。这种布局使得仓库本身可直接作为 `--plugin-dir` 目标使用（`codebuddy --plugin-dir .`），同时不干扰现有 `src/` 和 `tests/` 目录结构。无需新增 `.codebuddy/commands/` 目录——仅使用 Skills 模式。

## 复杂度跟踪

> 无违规项，无需填写。
