# 第三方省 Token 工具探测规则详解

`st diagnose` 自动检测 6 个第三方省 Token 工具的安装状态，并根据工具类型采用不同的探测策略。本文详解每种工具的检测规则、判定逻辑和数据来源。

## 工具清单与分类

| 工具     | 类型   | 预估节省                 | 典型安装方式                                 |
| -------- | ------ | ------------------------ | -------------------------------------------- |
| rtk      | CLI    | ~89% 命令输出压缩        | `brew install rtk`                           |
| caveman  | Plugin | 65-75% AI 回复压缩       | `git clone && install.sh` → marketplace 目录 |
| headroom | CLI    | 47-92% 上下文压缩        | `pip install headroom-ai[all]`               |
| lean-ctx | CLI    | 60-90% 读取筛选          | `brew install lean-ctx`                      |
| graphify | CLI    | 71.5x 代码图谱           | `uv tool install graphifyy`                  |
| ponytail | Plugin | 54% 代码量 + 20-75% 成本 | `codebuddy plugin marketplace add ...`       |

类型决定了探测策略：CLI 工具查 PATH，Plugin 工具查文件系统 + proxy 报文。

---

## 探测入口

`src/commands/diagnose.ts:429-473` 中的 `detectTools()` 函数：

```typescript
async function detectTools(
  fs: ReturnType<typeof scanFilesystem>,
  proxyParsed?: ProxyDiagnosisData,
): Promise<ToolDetection[]>
```

接受文件系统扫描结果（`fs`）和可选的 proxy 解析结果（`proxyParsed`）。调用点：

- **Proxy 成功**（`diagnose.ts:151`）：`detectTools(fs, proxyResult.parsed)` — 有 proxy 报文
- **Headless/fs-only**（`diagnose.ts:225`）：`detectTools(fs)` — 无 proxy 报文

无论哪种数据采集路径，`detectTools()` 都会执行。

---

## 策略一：CLI 工具（rtk / headroom / lean-ctx / graphify）

### 判定规则

```typescript
installed = await commandExists(t.id)
codebuddyIntegrated = installed
```

**核心逻辑**：在系统 PATH 中搜索二进制文件。

`commandExists()` 实现（`src/utils/platform.ts`）：

- **Unix（macOS/Linux）**：执行 `command -v <name> 2>/dev/null`，检查退出码
- **Windows**：执行 `where <name> 2>nul`，检查退出码
- **Termux（Android）**：Unix 路径，走 `command -v`

### 为什么 installed = codebuddyIntegrated？

CLI 工具作为外部进程被 CodeBuddy 的 Hook 系统调用（如 `rtk hook codebuddy`），只要 PATH 能找到，CodeBuddy 就能用。不存在「安装了但未集成」的中间态。

### 各工具检测示例

```bash
# rtk — Rust Token Killer
$ command -v rtk
/opt/homebrew/bin/rtk
# → installed: true, codebuddyIntegrated: true

# headroom — 上下文压缩 MCP
$ command -v headroom
/usr/local/bin/headroom
# → installed: true, codebuddyIntegrated: true

# lean-ctx — 智能上下文管理
$ command -v lean-ctx
# (无输出)
# → installed: false, codebuddyIntegrated: false

# graphify — 代码知识图谱
$ command -v graphify
# (无输出)
# → installed: false, codebuddyIntegrated: false
```

### 局限性

- **只查 PATH，不查功能完整度**：`rtk` 存在但未执行 `rtk init` 注册 hook，也算「已安装」
- **不验证版本**：`version` 字段始终为 `null`
- **不追踪安装路径**：`installPath` 字段始终为 `null`

---

## 策略二：Plugin 工具（caveman / ponytail）

Plugin 工具通过 CodeBuddy 插件市场安装，探测策略比 CLI 更复杂，涉及**三层判定**。

### 判定规则（优先级从高到低）

```typescript
// 1. 检查 marketplace 目录是否存在
const hasMarketplaceDir = await checkPluginMarketplaceDir(t.id)
// → 检查 ~/.codebuddy/plugins/marketplaces/<pluginId>/ 目录

// 2. 检查 enabledPlugins 中是否有启用项
const hasEnabledEntry = !!plugin?.enabled
// → 从 settings.json 的 enabledPlugins 中查找

// 3. Proxy 报文中的 mode-active 标记
if (!installed && proxyParsed) {
  installed = proxyDetectPlugin(t.id, proxyParsed)
}
// → 扫描拦截到的请求体中是否包含激活标记

installed = hasMarketplaceDir || hasEnabledEntry
codebuddyIntegrated = installed
```

### 第一层：Marketplace 目录检查

```typescript
async function checkPluginMarketplaceDir(pluginId: string): Promise<boolean> {
  const { exists: fileExists } = await import('../utils/fs-operations')
  return fileExists(`${process.env.HOME}/.codebuddy/plugins/marketplaces/${pluginId}/`)
}
```

**检测路径**：

- caveman → `~/.codebuddy/plugins/marketplaces/caveman/`
- ponytail → `~/.codebuddy/plugins/marketplaces/ponytail/`

目录存在 = 插件已从市场安装。这是最可靠的判定依据，因为：

- 即使插件被暂时禁用，目录仍然存在
- 即使 settings.json 中没有 enabledPlugins 条目（某些版本行为差异），目录说明已安装

### 第二层：enabledPlugins 检查

从 `settings.json` 的 `enabledPlugins` 对象中查找。`fs-collector.ts` 的 `scanPlugins()` 函数解析格式：

```json
{
  "enabledPlugins": {
    "caveman@caveman": true,
    "ponytail@ponytail": true
  }
}
```

解析逻辑（`fs-collector.ts:179`）：

```typescript
for (const [id, enabled] of Object.entries(settings.enabledPlugins ?? {})) {
  const [pluginId, marketplace] = id.split('@')
  // pluginId = 'caveman', marketplace = 'caveman'
}
```

`enabled: true` 且 `pluginId` 匹配 → 视为已安装。

### 第三层：Proxy 报文标记检测

只在**前两层都判定为未安装**且**有 proxy 数据**时触发。这是 ponytail 的特化路径。

```typescript
function proxyDetectPlugin(pluginId: string, parsed: ProxyDiagnosisData): boolean {
  const markers: Record<string, string> = {
    ponytail: 'PONYTAIL MODE ACTIVE',
  }
  const marker = markers[pluginId]
  if (!marker) return false
  for (const block of parsed.messageBreakdown) {
    if (block.snippet.includes(marker)) return true
  }
  return false
}
```

**为什么需要这层？**

Ponytail 在某些安装方式下（如从本地路径加载），marketplace 目录可能不在标准位置，`enabledPlugins` 条目也可能不完整。但 Ponytail 激活后会在 system-reminder 中注入 `PONYTAIL MODE ACTIVE` 标记。通过 proxy 拦截到实际发给 LLM 的请求体，可以反向推断 Ponytail 确实在工作。

**标记来源**：

```
<system-reminder data-role="hook">
PONYTAIL MODE ACTIVE — level: full
...
</system-reminder>
```

这是 CodeBuddy Hook 系统注入的 system-reminder 块。`proxyDetectPlugin` 遍历所有 message 的 `snippet` 字段，检查是否包含 `PONYTAIL MODE ACTIVE` 字符串。

**当前只支持 ponytail**：`markers` 对象只有 `ponytail: 'PONYTAIL MODE ACTIVE'` 一条。caveman 虽有 `CAVEMAN MODE ACTIVE` 标记，但 caveman 安装后 marketplace 目录稳定存在，前两层判定已足够，无需 proxy 兜底。

### caveman 的特殊处理

caveman 安装后在 `diagnose.ts:154-163` 有额外逻辑：

```typescript
// 如果 proxy 报文中检测到 caveman marker，强制设为已安装
if (proxyResult?.parsed) {
  for (const block of proxyResult.parsed.messageBreakdown) {
    if (block.snippet.includes('CAVEMAN MODE ACTIVE')) {
      // 确保 caveman 在 toolDetection 中标记为已安装
      const cavemanEntry = report.toolDetection.find((t) => t.name === 'caveman')
      if (cavemanEntry) {
        cavemanEntry.installed = true
        cavemanEntry.codebuddyIntegrated = true
      }
    }
  }
}
```

这段代码在 `detectTools()` 返回后执行，覆盖可能出现的误判。

---

## 数据流转

```
                    ┌──────────────────┐
                    │  scanFilesystem() │
                    │  → fs.pluginList  │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  detectTools()   │
                    │  + proxyParsed?  │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         CLI 工具       Plugin 工具    Plugin 工具
         (rtk等)     (caveman等)    (ponytail)
              │              │              │
              ▼              ▼              ▼
      commandExists()  checkPlugin-    proxyDetect-
                      MarketplaceDir()  Plugin()
                           │              │
                           ▼              ▼
                     enabledPlugins   messageBreakdown
                     条目检查         文本扫描
                             │
                             ▼
                    ┌──────────────────┐
                    │ ToolDetection[]  │
                    │ → report 输出    │
                    └──────────────────┘
```

---

## 与 optimize 命令的关系

`detectTools()` 的结果写入 `report.toolDetection`，供 `st optimize` 消费。

`st optimize` 的 `generateSuggestions()`（`src/analyzers/suggestion-engine.ts`）遍历 `toolDetection`：

- `installed === false` → 生成安装建议（actionType: `install-tool`）
- `installed === true && codebuddyIntegrated === false` → 生成集成建议

执行安装时通过 `src/executors/tool-installer.ts` 调用对应的 `installCommand`（定义在 `src/analyzers/rules.ts` 的 `TOOL_SPECS` 中）。

---

## 输出格式

`src/utils/output.ts` 中两处渲染：

### Terminal 格式

```
第三方工具检测
----------------------------------------
  ✓ rtk          已集成  (~89% 命令输出压缩)
  ✓ caveman      已集成  (65-75% AI 回复压缩)
  ✓ headroom     已集成  (47-92% 上下文压缩)
  ✓ graphify     已集成  (71.5x 代码图谱)
  ✓ ponytail     已集成  (54% 代码量 + 20-75% 成本)
```

只展示 `installed === true` 的工具。未安装的不显示。

### Markdown 格式

| 工具     | 已集成 | 推荐节省           |
| -------- | ------ | ------------------ |
| rtk      | true   | ~89% 命令输出压缩  |
| caveman  | true   | 65-75% AI 回复压缩 |
| headroom | true   | 47-92% 上下文压缩  |

同样只展示已安装的工具。

---

## 类型定义

```typescript
// src/types/index.ts:10
export type ToolId = 'rtk' | 'caveman' | 'headroom' | 'lean-ctx' | 'graphify' | 'ponytail'

// src/types/index.ts:120-127
export interface ToolDetection {
  name: ToolId
  installed: boolean
  version: string | null // 始终为 null，当前不提取版本
  installPath: string | null // 始终为 null，当前不追踪安装路径
  codebuddyIntegrated: boolean // CLI: = installed; Plugin: = installed
  recommendedSaving: string // 如 '~89% 命令输出压缩'
}
```

---

## 相关文件索引

| 文件                                     | 职责                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `src/commands/diagnose.ts:429-495`       | `detectTools()` + `checkPluginMarketplaceDir()` + `proxyDetectPlugin()` |
| `src/utils/platform.ts`                  | `commandExists()` PATH 搜索实现                                         |
| `src/collectors/fs-collector.ts:174-214` | `scanPlugins()` 从 settings.json 提取 pluginList                        |
| `src/analyzers/rules.ts`                 | `TOOL_SPECS` 安装/验证/配置命令定义                                     |
| `src/utils/output.ts:204-217,326-340`    | 终端和 Markdown 格式的工具检测输出                                      |
| `src/types/index.ts:10,120-127`          | `ToolId` 和 `ToolDetection` 类型定义                                    |
