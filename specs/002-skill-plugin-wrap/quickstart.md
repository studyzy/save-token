# 快速开始: save-token Plugin

**功能**: st CLI 改造为 SKILL 并封装为 Plugin
**日期**: 2026-07-09

## 前置条件

- Node.js 18+
- CodeBuddy Code（支持 Plugin 系统）
- `st` CLI 工具（`npm install -g save-token`）

## 安装 Plugin

### 方式 1: 本地开发测试

```bash
cd /path/to/save-token
codebuddy --plugin-dir .
```

### 方式 2: 从市场安装（未来）

```bash
/plugin install save-token
```

## 使用

安装后，三个 Skill 自动可用。直接在对话中用自然语言触发：

### 诊断 Token 占用

```
帮我诊断一下 token 占用
```

AI 自动调用 st-diagnose Skill，执行 `st diagnose --format json`，展示诊断报告。

### 分析优化空间

```
分析我的 token 优化空间
```

AI 自动调用 st-analyze Skill：

1. 询问你的使用场景和项目类型
2. 执行诊断（如尚未诊断）
3. 结合场景生成个性化优化建议

### 应用优化

```
应用这些优化
```

AI 自动调用 st-optimize Skill：

1. 展示变更摘要，请求确认
2. 执行 `st optimize --apply --yes`
3. 报告结果和备份位置

## 手动调用

也可使用命名空间化命令：

```
/save-token:diagnose
/save-token:analyze
/save-token:optimize
```

## Skill 工作流

```
st-diagnose         st-analyze          st-optimize
    │                    │                    │
    ▼                    ▼                    ▼
st diagnose         AskUserQuestion     AskUserQuestion
  --format json     (收集场景)           (确认变更)
    │                    │                    │
    ▼                    ▼                    ▼
展示诊断报告        读取诊断 JSON         st optimize
                    + 场景信息            --apply --yes
                       │                    │
                       ▼                    ▼
                   生成个性化建议        报告结果
                   按节省量排序          备份位置
```

## 卸载

```bash
/plugin uninstall save-token
```

## 验证记录

**日期**: 2026-07-09
**验证结果**:

- `.codebuddy-plugin/plugin.json`: JSON 格式有效，`name` 为 `save-token`，`skills` 声明 3 个 Skill，`compatibility` 声明 st CLI 依赖
- `skills/st-diagnose/SKILL.md`: frontmatter 完整，description 关键词（诊断、Token 占用、查看消耗）
- `skills/st-analyze/SKILL.md`: frontmatter 完整，description 关键词（优化建议、分析、减少 Token、个性化）
- `skills/st-optimize/SKILL.md`: frontmatter 完整，description 关键词（应用优化、执行、安装工具、修改配置）
- 三个 Skill 的 description 关键词不重叠，误触发风险低
- `st diagnose --format json` 输出格式与 SKILL.md 中描述的关键字段匹配
- 现有 TypeScript 代码不受影响：typecheck 通过，新增文件均为 Markdown/JSON
