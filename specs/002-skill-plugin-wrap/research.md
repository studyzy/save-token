# 研究文档: Skill 工作流设计

**功能**: st CLI 改造为 SKILL 并封装为 Plugin
**日期**: 2026-07-09

## R1: Skills vs Commands 选择

**Decision**: 仅使用 Skills，不用 Commands。

**Rationale**:

- 规范验收场景中，用户通过自然语言触发（"帮我诊断 token"、"分析优化空间"、"应用优化"），而非手动输入斜杠命令。
- FR-014 明确要求"AI 自动触发（通过 description 字段匹配任务）"。
- Skills 的 `description` frontmatter 支持 AI 自动匹配任务描述并调用，而 Commands 必须用户手动 `/command` 输入。
- OpenSpec-cn 同时提供 Skills + Commands 是出于兼容性考虑（部分用户习惯斜杠命令），但内容几乎相同（同一模板渲染两种形态），维护成本翻倍。我们仅需 Skills 即可覆盖规范要求。
- 备选手动调用路径：Skills 支持 `/save-token:diagnose` 等命名空间化命令，用户如有需要仍可手动调用。

**Alternatives considered**:

- Skills + Commands 双模式（OpenSpec-cn 模式）：增加维护负担，3 个 Skill 变成 6 个文件，且内容重复。
- 仅 Commands：用户必须知道精确命令名，无法通过"帮我诊断 token"这样的自然语言触发，不符合规范。

## R2: Skill 与 CLI 的数据传递方式

**Decision**: Skill 正文中用 bash 代码块调用 `st <subcommand> --format json`，AI 解析 JSON 输出并格式化呈现。

**Rationale**:

- `st diagnose --format json` 输出完整 `DiagnosisReport` JSON，字段明确、可解析。
- `st analyze --format json` 输出 `{ report, suggestions, totalSaving, totalPercent }` JSON。
- `st optimize --apply --yes` 输出逐行结果文本（非 JSON），AI 直接解读终端输出。
- 这种"描述式 CLI 委托"模式与 OpenSpec-cn 一致：Skill 不 import CLI，而是指导 AI 调用 CLI 并消费输出。
- 诊断结果通过 `--report <path>` 写入文件，`st-analyze` 可读取复用，避免重复采集。

**Alternatives considered**:

- Skill 直接 import CLI 模块：不可行，Skill 是 Markdown 文件，无法 import TypeScript。
- 通过 MCP 工具调用：过度设计，`st` 已是独立 CLI 工具。

## R3: st-analyze 场景收集策略

**Decision**: Skill 正文中指导 AI 通过 `AskUserQuestion` 工具主动询问用户使用场景，不猜测。

**Rationale**:

- FR-006 要求"主动询问用户的主要使用场景，而非使用默认值"。
- `st analyze` CLI 已有交互式询问 `askScenario()`，返回 `'coding' | 'docs' | 'general'`。
- Skill 层的场景收集应更丰富（不仅限于 coding/docs/general），可包括：主要使用场景（编码/审查/架构/全栈）、项目类型（前端/后端/全栈/工具库）、技术栈。
- 场景信息传递给 `st analyze` CLI 或由 AI 在 Skill 层结合诊断数据直接生成建议。

**Implementation**:

- Skill 指导 AI 使用 `AskUserQuestion` 工具收集 3 个维度：使用场景、项目类型、技术栈。
- 收集后执行 `st diagnose --format json` 获取诊断数据。
- AI 结合场景信息和诊断数据，生成个性化建议。可选择性调用 `st analyze --format json` 作为基础建议参考。

## R4: Plugin 目录结构

**Decision**: 仓库根目录即为 Plugin 根目录，`.codebuddy-plugin/plugin.json` + `skills/` 目录。

**Rationale**:

- CodeBuddy Plugin 标准结构：`.codebuddy-plugin/plugin.json` 在根目录，`skills/` 也在根目录。
- 这种布局使得 `codebuddy --plugin-dir .` 可直接加载本仓库作为插件。
- 不干扰现有 `src/`、`tests/`、`docs/` 目录。
- 不需要 `commands/` 目录（仅 Skills）。

**目录结构**:

```
.codebuddy-plugin/
└── plugin.json

skills/
├── st-diagnose/
│   └── SKILL.md
├── st-analyze/
│   └── SKILL.md
└── st-optimize/
    └── SKILL.md
```

## R5: Skill 工作流设计

### st-diagnose 工作流

```
用户表达诊断意图
    │
    ▼
检测 st 命令是否存在 (which st)
    │
    ├─ 不存在 → 提示安装指引 → 结束
    │
    ▼
执行 st diagnose --format json [--no-headless]
    │
    ▼
解析 JSON 输出 → 格式化呈现：
  - Token 总占用 + 分布
  - MCP/Skill/Plugin 列表 + 估算
  - 数据来源标记
  - 潜在问题警告
    │
    ▼
可选：st diagnose --report <path> 写入文件供后续 Skill 使用
```

### st-analyze 工作流

```
用户表达分析意图
    │
    ▼
检查诊断结果是否可用（5 分钟内）
    │
    ├─ 不可用 → 执行 st diagnose --format json --report <path>
    │
    ▼
使用 AskUserQuestion 收集场景信息：
  - 主要使用场景（编码/审查/架构/全栈）
  - 项目类型（前端/后端/全栈/工具库）
  - 技术栈
    │
    ▼
读取诊断 JSON → 结合场景信息生成建议
（可选：调用 st analyze --format json 获取基础建议参考）
    │
    ▼
按节省量排序展示建议列表：
  - 操作类型 + 内容
  - 预计节省 token / 百分比
  - 风险等级
  - 与场景的关联说明
```

### st-optimize 工作流

```
用户表达执行优化意图
    │
    ▼
检查分析结果是否可用
    │
    ├─ 不可用 → 执行 st-analyze 流程（诊断 + 场景收集 + 建议）
    │
    ▼
展示将要执行的变更摘要，请求用户确认
    │
    ├─ 拒绝 → 结束
    │
    ▼
执行 st optimize --apply --yes
    │
    ▼
解读终端输出，逐项报告：
  - ✓/✗ 每个变更状态
  - 备份文件位置
  - 总节省 token 量
    │
    ▼
建议：重启 CodeBuddy 使变更生效
```
