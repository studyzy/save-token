<!--
  ============================================================================
  同步影响报告
  版本变更: 0.0.0 → 1.0.0 (初始章程, 首次批准)
  新增原则:
    - I. 代码质量标准
    - II. 测试优先(不可协商)
    - III. 文档规范(英文注释, 中文文档)
    - IV. 简洁性与最小必要代码
    - V. 版本控制与变更管理
  新增章节:
    - 附加约束(技术栈, 命名规范, Lint 与格式化)
    - 开发工作流(分支策略, 代码审查, 质量门控)
  删除章节: 无
  模板同步状态:
    ✅ .specify/templates/plan-template.md - 无需变更(章程检查部分已预留)
    ✅ .specify/templates/spec-template.md - 无需变更
    ✅ .specify/templates/tasks-template.md - 无需变更(测试任务已支持)
    ✅ .specify/templates/agent-file-template.md - 无需变更
    ✅ .specify/templates/checklist-template.md - 无需变更
    ✅ .specify/templates/constitution-template.md - 无需变更(原始模板)
  待办事项: RATIFICATION_DATE 使用今天日期(项目新立)
  ============================================================================
-->

# save-token 项目章程

## 核心原则

### I. 代码质量标准

所有代码 MUST 遵循严格、规范的编码标准。

- 所有注释 MUST 使用英文编写。
- 所有文档(README, spec, 设计文档) MUST 使用中文编写。
- 代码 MUST 通过 ESLint(或等效静态分析工具)检查, 零 warning。
- 类型标注 MUST 完整且准确(TypeScript strict 模式或等效)。
- 命名 MUST 遵循语言社区约定(camelCase/PascalCase/snake_case 视语言而定)。
- 禁止提交包含 `console.log`、`TODO` 无责任人、被注释掉的代码块。

**理由**: 统一代码风格降低认知负担, 英文注释确保国际化协作可行性,
中文文档确保团队内部沟通效率。

### II. 测试优先(不可协商)

测试是交付的必要条件, 不可跳过。

- 单元测试覆盖率 MUST >= 60%(语句覆盖率)。
- 每个新功能 MUST 包含对应的单元测试。
- Bug 修复 MUST 包含回归测试(先写测试复现 bug, 再修复)。
- 测试 MUST 可独立运行, 不依赖外部服务(数据库、网络等需 mock/stub)。
- CI 流水线 MUST 在覆盖率不达标时阻断合并。
- 测试用例命名 MUST 清晰描述被测行为和预期结果。

**理由**: 测试是代码质量的唯一客观度量, 60% 覆盖率是在效率与质量间的
合理平衡点。可独立运行的测试确保 CI 可靠性和开发体验。

### III. 文档规范

文档是代码的一部分, 与代码同步维护。

- README.md MUST 包含: 项目简介、快速开始、核心概念、贡献指南。
- 架构决策 MUST 记录在 `docs/architecture/` 目录中(ADR 格式)。
- 公共 API 和接口 MUST 有文档注释(英文)。
- 用户手册和操作指南 MUST 使用中文编写。
- 变更日志 MUST 维护在 `CHANGELOG.md` 中, 遵循 Keep a Changelog 格式。

**理由**: 好的文档降低新成员上手成本, ADR 保留技术决策上下文,
变更日志让用户了解版本间差异。

### IV. 简洁性与最小必要代码

避免过度工程化, 只编写解决当前问题所需的最小代码。

- YAGNI(You Aren't Gonna Need It): 不为假设的未来需求编写代码。
- 单一职责: 每个函数、类、模块 MUST 有单一明确的目的。
- 代码行数: 单文件不超过 500 行, 单函数不超过 50 行(合理例外允许, 但需在 review 中说明)。
- 依赖最小化: 能用标准库解决的问题不引入第三方依赖。
- 删除死代码: 废弃的代码 MUST 立即删除, 而非注释保留。

**理由**: 代码是负债, 不是资产。每多一行代码就多一行维护成本。
简洁的代码更容易测试、审查和修改。

### V. 版本控制与变更管理

所有变更 MUST 通过规范的版本控制流程管理。

- 语义化版本(SemVer): MAJOR.MINOR.PATCH 格式。
- 每个提交 MUST 有清晰、描述性的消息(Conventional Commits 格式)。
- 分支策略: `main` 为稳定分支, 功能开发在 `feature/*` 分支,
  修复在 `fix/*` 分支。
- 合并到 `main` MUST 通过 Pull Request, 且至少一人审查通过。
- 破坏性变更 MUST 在 PR 描述中明确标注, 并包含迁移指南。

**理由**: 规范的版本控制是可追溯、可回滚、可协作的基础。
Conventional Commits 支持自动化变更日志生成和版本号管理。

## 附加约束

### 技术栈要求

- **语言**: TypeScript (strict 模式), 目标 ES2022+
- **运行时**: Node.js 18+
- **包管理器**: pnpm
- **测试框架**: Vitest
- **Lint**: ESLint + Prettier
- **提交规范**: Commitlint + Husky

### 命名规范

- 文件名: kebab-case (`token-storage.ts`)
- 类/接口: PascalCase (`TokenStorage`)
- 函数/变量: camelCase (`saveToken`)
- 常量: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- 测试文件: `*.test.ts` 或 `*.spec.ts`, 与源文件同目录或镜像目录结构

### Lint 与格式化

- 代码格式化 MUST 使用 Prettier, 配置统一提交到仓库。
- ESLint 规则 MUST 使用推荐的严格规则集。
- 提交前 MUST 通过 `lint-staged` 自动检查和格式化。

## 开发工作流

### 分支策略

- `main`: 稳定可发布分支, 禁止直接推送。
- `feature/<name>`: 功能开发分支, 从 `main` 拉出, 完成后合并回 `main`。
- `fix/<name>`: Bug 修复分支, 从 `main` 拉出, 完成后合并回 `main`。
- `release/<version>`: 发布准备分支(可选, 大型项目使用)。

### 代码审查要求

- 每个 PR MUST 至少有一位审查者批准。
- 审查者 MUST 检查: 测试覆盖、文档更新、代码风格、潜在 bug。
- PR 描述 MUST 包含: 变更目的、测试方法、破坏性变更说明(如有)。

### 质量门控

- CI 流水线 MUST 通过以下检查才能合并:
  - Lint 检查(零 warning)
  - 单元测试(全部通过, 覆盖率 >= 60%)
  - 类型检查(零错误)
  - 构建成功

## 治理

本章程是项目的最高指导文件, 优先级高于所有其他实践文档。

- 所有代码提交、PR 审查、架构决策 MUST 遵循本章程定义的原则。
- 违反章程的代码 MUST 在合并前修正, 或明确记录例外理由。
- 章程修订需要:
  1. 提出修订提案(文档化变更内容和理由)
  2. 团队讨论和批准
  3. 更新版本号(遵循 SemVer)
  4. 更新相关模板和文档
- 复杂性如果违背"简洁性"原则, MUST 在 PR 或设计文档中证明其合理性。
- 运行时开发指导参见 `README.md` 和 `docs/` 目录。

**版本**: 1.0.0 | **批准日期**: 2026-07-01 | **最后修订**: 2026-07-01
