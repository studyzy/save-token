# Proxy 诊断方案设计

日期：2026-07-02

## 概述

`st diagnose` 增加 Proxy 模式作为优先数据源。启动轻量 HTTP Proxy → 设置 `CODEBUDDY_BASE_URL` → 运行 `codebuddy -p "Hello"` → 透明转发到真实 API → 捕获请求 body → 解析生成报告。

## 动机

现有 `st diagnose` 的 headless 探测依赖 `codebuddy -p` 让模型自报 MCP/Skill 列表，不够精确。Proxy 模式直接拦截 CodeBuddy 发送给 LLM 的 HTTP 请求 body，能看到完整的 messages 数组、tools 定义、system prompt 等实际内容，数据最真实。

## 数据源优先级

```
st diagnose
├── 检测 CODEBUDDY_BASE_URL 代理是否可用（headroom 或其他 Proxy）
├── 可用 → Proxy 模式
├── 不可用 → headless 探测（现有方案 fallback）
└── --no-headless → 仅文件扫描
```

新增 `dataSource: 'proxy' | 'headless' | 'fs-only'` 字段到 `DiagnosisReport`。

## 架构

### 新增模块

| 文件 | 职责 |
|------|------|
| `src/collectors/proxy-collector.ts` | 启动 Proxy、管理生命周期、收集捕获数据 |
| `src/proxy/server.ts` | HTTP Proxy 实现（拦截 + 转发） |
| `src/proxy/parser.ts` | 解析请求 body，按 system/memory/skills/tools/messages 分类统计 |
| `src/proxy/api-forwarder.ts` | 透明转发到 CodeBuddy 真实后端 |

### 数据流

```
codebuddy -p "Hello"
  → POST http://127.0.0.1:<port>/v2/messages (body: messages[], tools[], ...)
    → Proxy 拦截，拷贝 body
    → 转发到真实 API (CODEBUDDY_API_BASE 或默认端点)
    → 返回 LLM 响应给 codebuddy
  → Proxy 关闭
  → parser.ts 解析 body:
      - 统计 messages 按 role 分类（system/user/assistant/tool）
      - 提取 system prompt 内容
      - 列出 tools 定义
      - 识别 skills/memory 相关 message
      - 估算 token 数
  → 生成 DiagnosisReport（复用现有结构）
  → 输出报告到 --report 路径
  → 原始 body 存 <report-path>-raw.json
```

### Proxy 设计

- 启动在随机可用端口，避免冲突
- 设置 `CODEBUDDY_BASE_URL=http://127.0.0.1:<port>/v2`
- 透明转发：请求到达 → 拷贝 body → 转发到真实 CodeBuddy API → 返回响应
- 转发目标：从 CodeBuddy 默认 API 端点获取（可通过 `CODEBUDDY_API_BASE` 环境变量覆盖）
- 超时：60s（与 headless 一致）
- 仅拦截第一个匹配的 POST 请求，之后自动关闭

### 与现有代码的关系

- `src/commands/diagnose.ts` 中的 `runDiagnose()` 增加 Proxy 分支
- Proxy 可用时跳过 `probe()` headless 调用
- `mergeMcpLists()` / `mergeSkillLists()` 仍用于合并文件系统数据
- `DiagnosisReport` 类型不变，新增 `dataSource` 字段
- 现有 `printDiagnosisReport()` 输出逻辑不变

## 输出

### 原始数据文件

`<report-path>-raw.json`：完整的请求 body，用于调试和审查。

### 报告文件

按现有 `--format terminal|json|md` 输出，内容基于 Proxy 捕获的精确数据：

- 按 role 分类的 messages 统计（system/user/assistant/tool 各占多少 token）
- tools 列表及数量
- 识别出的 skills/memory/上下文 来源
- 与文件系统扫描结果的交叉对比

## 风险与注意事项

- **真实 API 调用**：Proxy 模式会实际发送一次 API 请求，消耗少量 Token（"Hello" 对话）
- **端口冲突**：使用随机端口，极低概率冲突
- **网络依赖**：需要能访问 CodeBuddy API 端点
- **安全**：Proxy 仅监听 `127.0.0.1`，不对外暴露
