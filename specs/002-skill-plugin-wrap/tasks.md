# 任务: st CLI 改造为 SKILL 并封装为 Plugin

**输入**: 来自 `/specs/002-skill-plugin-wrap/` 的设计文档
**前置条件**: plan.md, spec.md, research.md, data-model.md, contracts/cli-contracts.md

**测试**: 不要求——Skill 文件为纯 Markdown 声明，无代码逻辑。`st` CLI 已有测试覆盖（>60%）。本功能仅创建声明式文件。

**组织结构**: 任务按用户故事分组���每个故事可独立实施和测试。

## 格式: `[ID] [P?] [Story] 描述`

- **[P]**: 可以并行运行（不同文件，无依赖关系）
- **[Story]**: 此任务属于哪个用户故事（US1, US2, US3, US4）
- 描述中包含确切的文件路径

## 路径约定

Plugin 文件位于仓库根目录：

- `.codebuddy-plugin/plugin.json` — Plugin 清单
- `skills/<name>/SKILL.md` — Skill 定义文件

---

## 阶段 1: 设置（共享基础设施）

**目的**: 创建 Plugin 目录结构和清单文件

- [x] T001 创建 Plugin 目录结构：`.codebuddy-plugin/`、`skills/st-diagnose/`、`skills/st-analyze/`、`skills/st-optimize/`
- [x] T002 在 `.codebuddy-plugin/plugin.json` 中编写 Plugin 清单文件（name: save-token, version: 1.0.0, 声明 skills 列表和 compatibility 依赖）

**检查点**: Plugin 骨架就绪，可加载空壳验证结构正确

---

## 阶段 2: 用户故事 1 - Token 诊断（优先级: P1）🎯 MVP

**目标**: 用户表达诊断意图时，AI 自动触发 st-diagnose Skill，调用 `st diagnose --format json` 并呈现结构化诊断报告

**独立测试**: 在 CodeBuddy 会话中说"帮我诊断 token 占用"，验证 AI 调用 st-diagnose Skill，执行 `st diagnose` 并展示报告

### 用户故事 1 的实施

- [x] T003 [US1] 在 `skills/st-diagnose/SKILL.md` 中编写 Skill 定义：frontmatter（name, description, allowed-tools）和正文工作流（检测 st 命令 → 执行 st diagnose --format json → 解析 JSON → 格式化呈现诊断报告）
- [x] T004 [US1] 在 T003 的 SKILL.md 中补充异常处理：st 命令缺失时的安装指引、st diagnose 失败时的降级展示

**检查点**: 用户故事 1 完成——用户可在任意会话中诊断 Token 占用

---

## 阶段 3: 用户故事 2 - 优化分析与建议（优先级: P2）

**目标**: 用户表达分析意图时，AI 自动触发 st-analyze Skill，收集使用场景信息，结合诊断数据生成个性化优化建议

**独立测试**: 用户说"分析我的 token 优化空间"，验证 AI 调用 st-analyze Skill，收集场景信息后返回排序后的建议列表

### 用户故事 2 的实施

- [x] T005 [US2] 在 `skills/st-analyze/SKILL.md` 中编写 Skill 定义：frontmatter（name, description, allowed-tools）和正文工作流（检查诊断结果可用性 → 用 AskUserQuestion 收集场景/项目类型/技术栈 → 执行 st diagnose --format json（如未诊断）→ 结合场景生成个性化建议 → 按节省量排序展示）
- [x] T006 [US2] 在 T005 的 SKILL.md 中补充场景收集逻辑：定义 3 个 AskUserQuestion 问题（使用场景、项目类型、技术栈），处理用户跳过场景收集的情况（使用通用分析）

**检查点**: 用户故事 2 完成——用户可获得场景感知的个性化优化建议

---

## 阶段 4: 用户故事 3 - 优化执行（优先级: P3）

**目标**: 用户表达执行意图时，AI 自动触发 st-optimize Skill，展示变更摘要并获取确认后执行优化

**独立测试**: 用户说"应用这些优化"，验证 AI 调用 st-optimize Skill，展示预览 → 确认 → 执行 → 报告结果

### 用户故事 3 的实施

- [x] T007 [US3] 在 `skills/st-optimize/SKILL.md` 中编写 Skill 定义：frontmatter（name, description, allowed-tools）和正文工作流（检查分析结果可用性 → 如不可用则执行诊断+分析 → 展示变更摘要 → 用 AskUserQuestion 确认 → 执行 st optimize --apply --yes → 解读输出 → 逐项报告状态和备份位置 → 建议重启 CodeBuddy）
- [x] T008 [US3] 在 T007 的 SKILL.md 中补充部分失败处理逻辑：区分成功/失败的变更项，报告备份位置，建议用户可通过 st rollback 恢复

**检查点**: 用户故事 3 完成——用户可一键应用优化建议

---

## 阶段 5: 用户故事 4 - Plugin 封装与验证（优先级: P4）

**目标**: 确保 Plugin 符合 CodeBuddy 标准，可通过 `--plugin-dir` 加载，Skills 命名空间化且可自动触发

**独立测试**: `codebuddy --plugin-dir .` 加载后，三个 Skill 出现在 `/skills` 列表中，自然语言触发正确匹配

### 用户故事 4 的实施

- [x] T009 [US4] 验证 `.codebuddy-plugin/plugin.json` 格式正确（name 为 `save-token`，skills 声明完整，compatibility 声明 st CLI 依赖）
- [x] T010 [US4] 验证三个 SKILL.md 的 description 字段能正确匹配用户意图（诊断/分析/执行 三种场景不交叉误触发）
- [x] T011 [US4] 运行 quickstart.md 中的验证步骤：`codebuddy --plugin-dir .` 加载插件，检查 `/skills` 列表，手动触发 `/save-token:diagnose`、`/save-token:analyze`、`/save-token:optimize`

**检查点**: Plugin 封装完成——可在任意项目中使用

---

## 阶段 6: 完善与横切关注点

**目的**: 文档和最终验证

- [x] T012 [P] 在 `specs/002-skill-plugin-wrap/quickstart.md` 中补充实际验证结果截图或输出
- [x] T013 运行 `st diagnose --format json` 验证 CLI 输出格式与 SKILL.md 中描述的解析逻辑一致
- [x] T014 [P] 更新项目 README.md 添加 Plugin 安装和使用说明
- [x] T015 运行 `pnpm typecheck && pnpm lint && pnpm test:run` 确保现有代码不受影响

---

## 依赖关系与执行顺序

### 阶段依赖关系

- **设置（阶段 1）**: 无依赖——立即开始
- **US1（阶段 2）**: 依赖设置完成——可独立实施
- **US2（阶段 3）**: 依赖设置完成——可与 US1 并行（但逻辑上建议在 US1 后，因需要诊断数据）
- **US3（阶段 4）**: 依赖设置完成——建议在 US2 后（因需要分析结果）
- **US4（阶段 5）**: 依赖 US1+US2+US3 完成——验证所有 Skill
- **完善（阶段 6）**: 依赖所有用户故事完成

### 用户故事依赖关系

```
阶段 1: 设置
    │
    ├── US1 (st-diagnose) ── 无故事依赖
    │       │
    │       └── US2 (st-analyze) ── 建议依赖 US1（复用诊断数据）
    │               │
    │               └── US3 (st-optimize) ── 建议依赖 US2（复用分析结果）
    │
    └── US4 (Plugin 封装) ── 依赖 US1+US2+US3
```

**注意**: 虽然 US2 和 US3 逻辑上依赖前面的 Skill，但它们可独立实施——每个 Skill 内部都有"如诊断/分析结果不可用则自动执行前置步骤"的降级逻辑。

### 并行机会

- T001 和 T002 可顺序执行（T002 依赖目录结构）
- T003 [US1] 和 T005 [US2] 和 T007 [US3] 可并行编写（不同文件，无代码依赖）
- T009, T010 [US4] 可并行执行
- T012, T014 [完善] 可并行执行
- T013, T015 [完善] 可并行执行

---

## 并行示例: US1 + US2 + US3

```bash
# 设置完成后，三个 Skill 文件可并行编写：
任务: "在 skills/st-diagnose/SKILL.md 中编写 Skill 定义"
任务: "在 skills/st-analyze/SKILL.md 中编写 Skill 定义"
任务: "在 skills/st-optimize/SKILL.md 中编写 Skill 定义"
```

---

## 实施策略

### 仅 MVP（仅 US1）

1. 完成阶段 1: 设置（T001, T002）
2. 完成阶段 2: US1（T003, T004）
3. **停止并验证**: 加载 Plugin，说"帮我诊断 token"，验证诊断报告
4. 可演示/交付 MVP

### 增量交付

1. 设置 → Plugin 骨架就绪
2. US1 → 独立测试 → 诊断功能可用（MVP）
3. US2 → 独立测试 → 分析+建议可用
4. US3 → 独立测试 → 一键优化可用
5. US4 → 验证 → Plugin 封装完成
6. 每个 Skill 增加独立价值

### 单开发者策略

按优先级顺序：T001→T002→T003→T004→T005→T006→T007→T008→T009→T010→T011→T012→T013→T014→T015

---

## 任务摘要

| 阶段     | 任务数 | 说明                          |
| -------- | ------ | ----------------------------- |
| 设置     | 2      | 目录结构 + plugin.json        |
| US1 (P1) | 2      | st-diagnose SKILL.md          |
| US2 (P2) | 2      | st-analyze SKILL.md           |
| US3 (P3) | 2      | st-optimize SKILL.md          |
| US4 (P4) | 3      | Plugin 验证                   |
| 完善     | 4      | 文档 + 验证                   |
| **总计** | **15** | 全部为 Markdown/JSON 文件操作 |

## 注意事项

- [P] 任务 = 不同文件，无依赖关系
- [Story] 标签将任务映射到特定用户故事
- 每个 Skill 独立可测试（即使前置 Skill 未实现，降级逻辑可自动执行前置步骤）
- Skill 文件为纯 Markdown，不需要 TypeScript 编译
- Plugin 加载后需运行 `/reload-plugins` 刷新变更
- 保持 SKILL.md 描述精确——避免 Skill 之间误触发
