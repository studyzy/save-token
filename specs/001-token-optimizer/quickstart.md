# 快速开始: Token 优化器

## 安装

```bash
# 全局安装
pnpm add -g save-token

# 或 npx 临时执行
npx save-token diagnose
```

## 三步完成优化

### 1. 诊断 CodeBuddy 环境

```bash
st diagnose
```

输出当前 CodeBuddy 的上下文占用、MCP/Skill/插件/Hook 列表、第三方工具检测。

### 2. 查看优化建议

```bash
st analyze
```

基于诊断数据生成优化建议报告，含预估节省 Token 数。

### 3. 执行优化

```bash
# 默认 dry-run，仅查看将执行的操作
st optimize

# 确认后真实执行
st optimize --apply
```

执行内容包括：
- 安装省 Token 工具（RTK、Caveman、Headroom、lean-ctx、Graphify）
- 优化 CodeBuddy 配置（禁用低频 MCP/插件、启用 defer_loading）

## 其他命令

```bash
# 仅安装指定工具
st optimize --tool rtk --apply

# 回滚最近一次优化
st rollback

# 导出完整报告
st report --output ~/Desktop/st-report.md
```

## 常见场景

### 场景 1: 首次使用

```bash
st diagnose          # 看当前状态
st analyze           # 看建议
st optimize --apply  # 执行
```

### 场景 2: 只装 RTK

```bash
st optimize --tool rtk --apply --yes
```

### 场景 3: 出问题要回滚

```bash
st rollback          # 恢复最近备份
st rollback --to 20260701180000  # 恢复指定时间戳
```

### 场景 4: CI/CD 集成

```bash
st diagnose --format json > diagnose.json
st analyze --format json > suggestions.json
st optimize --apply --yes
```

## 输出格式

所有命令支持三种输出格式：

```bash
st diagnose --format terminal  # 默认，彩色终端
st diagnose --format json      # JSON（程序化处理）
st diagnose --format md        # Markdown（文档）
```

## 注意事项

- 所有配置修改默认 dry-run，`--apply` 才真改
- 修改前自动备份到 `~/.codebuddy/*.bak.{timestamp}`
- CODEBUDDY.md 精简只生成 diff，不自动写入（需手动复制）
- `codebuddy -p` 调用失败时降级为仅文件扫描，会标注"运行时数据不可用"
