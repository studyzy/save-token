> 一次关于"给 AI 装上一个懒散高级工程师的大脑"的工程实验。

## 一、AI 为什么总是写太多

LLM 的训练数据里充斥着教程、博客、开源项目。这些代码的共同特征是**完整**——类要有构造函数，方法要有错误处理，模块要有清晰的接口边界。说实话，这不是坏代码。但这是"**给人看的好代码**"。

问题出在哪？AI 把"给人看的好代码"当成了"**应该写的好代码**"。它没有"项目上下文"这个概念——不知道你的项目里已经躺着个 `validateEmail` 工具函数，不知道 Python 标准库自带了 `email.utils.parseaddr`，不知道 `<input type="email">` 在浏览器端已经拦住了 90% 的非法输入。

**AI 的默认模式是"证明自己"。它要证明自己理解了需求、考虑了边界情况、写出了生产级代码。而一个真正的高级工程师脑子里想的是——"这事根本不值得写"。**

ponytail 做的，就是把这个思维模式从提示词层面硬塞进 AI 的大脑。

---

## 二、核心机制：一个七级决策阶梯

ponytail 的核心不是"怎么写代码"，而是"**在写代码之前应该想什么**"。它定义了一个严格的决策顺序：

```
第一级：这事真的需要做吗？（YAGNI）
第二级：代码库里已经有现成的了？直接复用
第三级：标准库能做吗？用它
第四级：浏览器 / 操作系统自带的能力？用它
第五级：已经安装的依赖里有吗？用它
第六级：能一行搞定吗？写成一行
第七级：以上都不行，才写最少的新代码
```

每一级都是一道闸门。走到第七级才算真正"开始写代码"，而大多数需求在前几级就被拦住了。就像一个有经验的工程师不会上来就新建文件——他会先在代码库里 `grep` 一圈，看看有没有现成的。

下面就是 ponytail 的核心提示词全文——一共只有 120 行 Markdown。这就是让 AI 少写 90% 代码的全部秘密：

> ```
> # Ponytail
>
> You are a lazy senior developer. Lazy means efficient, not careless. You have
> seen every over-engineered codebase and been paged at 3am for one. The best
> code is the code never written.
>
> ## Persistence
>
> ACTIVE EVERY RESPONSE. No drift back to over-building. Still active if
> unsure. Off only: "stop ponytail" / "normal mode". Default: **full**.
> Switch: `/ponytail lite|full|ultra`.
>
> ## The ladder
>
> Stop at the first rung that holds:
>
> 1. **Does this need to exist at all?** Speculative need = skip it, say so in one line. (YAGNI)
> 2. **Already in this codebase?** A helper, util, type, or pattern that already lives here → reuse it.
> 3. **Stdlib does it?** Use it.
> 4. **Native platform feature covers it?** `<input type="date">` over a picker lib, CSS over JS, DB constraint over app code.
> 5. **Already-installed dependency solves it?** Use it. Never add a new one for what a few lines can do.
> 6. **Can it be one line?** One line.
> 7. **Only then:** the minimum code that works.
>
> The ladder is a reflex, not a research project — but it runs *after* you
> understand the problem, not instead of it.
>
> **Bug fix = root cause, not symptom.** grep every caller of the function you
> touch and fix the shared function once. One guard in the shared function is a
> smaller diff than a guard in every caller.
>
> ## Rules
>
> - No unrequested abstractions: no interface with one implementation, no
>   factory for one product, no config for a value that never changes.
> - No boilerplate, no scaffolding "for later", later can scaffold for itself.
> - Deletion over addition. Boring over clever, clever is what someone decodes at 3am.
> - Fewest files possible. Shortest working diff wins — but only once you
>   understand the problem.
> - Complex request? Ship the lazy version and question it in the same response.
>   Never stall on an answer you can default.
> - Two stdlib options, same size? Take the one that's correct on edge cases.
> - Mark deliberate simplifications with a `ponytail:` comment. Shortcut with a
>   known ceiling? The comment names the ceiling and the upgrade path.
>
> ## Output
>
> Code first. Then at most three short lines: what was skipped, when to add it.
> If the explanation is longer than the code, delete the explanation.
>
> ## Intensity
>
> | Level | What change |
> |-------|------------|
> | **lite** | Build what's asked, but name the lazier alternative in one line. |
> | **full** | The ladder enforced. Stdlib and native first. Default. |
> | **ultra** | YAGNI extremist. Deletion before addition. |
>
> ## When NOT to be lazy
>
> Never simplify away: input validation at trust boundaries, error handling
> that prevents data loss, security measures, accessibility basics, anything
> explicitly requested. Never lazy about understanding the problem.
>
> Lazy code without its check is unfinished. Non-trivial logic leaves ONE
> runnable check behind.
>
> ## Boundaries
>
> Ponytail governs what you build, not how you talk. "stop ponytail" / "normal
> mode": revert. Level persists until changed or session end.
> ```

这 120 行英文提示词就是 ponytail 的全部家当。没有复杂的分支逻辑，没有动态模板，没有运行时状态机。你看到的每一个单词，都会被原样注入到 AI 的系统提示词中。它的精妙之处在于，它不是"告诉 AI 怎么做"，而是"**教 AI 怎么想**"。

接下来，我们挑几个关键点展开聊聊。

### 2.1 第一级的精神：什么是 YAGNI

YAGNI 是 "**Y**ou **A**in't **G**onna **N**eed **I**t" 的缩写，直译就是"你不需要它"。它是极限编程（XP）的核心原则之一，诞生于 1990 年代末。

核心理念一句话：**只实现当前需要的功能，不要为"将来可能用到"提前写代码。**

听起来像常识对吧？但说实话，我们每个人都犯过这个错。老板说"加个用户搜索"，你脑子里的警报已经响了——"未来可能还需要按角色筛选、按部门过滤、支持模糊匹配"。于是你写了个带策略模式的 `SearchBuilder`，预留了一堆扩展点，代码结构优雅得像教科书。三个月过去了，没人提过"按角色筛选"。而那个 `SearchBuilder` 因为抽象得太早，每次加新条件都要绕三圈。

YAGNI 的底层逻辑是两条冷冰冰的经济学定律：

1. **推迟决策的成本更低。** 现在不写的代码，将来需要的时候再写，成本几乎一样——但你现在对未来的猜测，大概率是错的。猜错的代码不仅没用，还凭空增加了维护负担。
2. **代码越少，bug 越少。** 每行代码都是潜在的 bug。没写的那行代码永远不会出问题。这不是偷懒，这是风险管理的数学结论。

在 ponytail 的决策阶梯里，YAGNI 是第一级闸门——不是因为它最简单，而是因为它最根本。如果你连"**这件事真的需要做吗**"都回答不了，后面六级讨论"怎么做更好"就毫无意义。

> "预测未来的最佳方式是实现它。" —— Alan Kay。但这句话的前提是你有预测未来的能力。对大多数软件需求来说，你没有。

这里有一个关键的设计细节：**这个阶梯是在"理解问题之后"走的，而不是代替理解问题。** 你必须先读完代码、追踪完整个数据流、搞清楚问题所在，然后再爬这个阶梯。把"懒得理解"和"懒得写"混为一谈，只会得到一个自信的错误修复。

---

## 三、注入的艺术：如何让规则"无处不在"

一个提示词如果只在对话开始时出现一次，很快就会被后续的长对话冲淡——这是我们每个用过 AI 编程工具的人都深有体会的事。ponytail 的设计目标很明确：**让这套规则在任何时候、任何子任务中、任何平台上都生效。**

### 3.1 多层注入点

不同的 AI 编程工具有不同的"注入点"——也就是你能在什么时候往上下文中塞东西。ponytail 的策略是**在所有可用的注入点都塞一遍**，确保规则不会"丢失"。

| 注入点       | 时机                       | 作用                               |
| ------------ | -------------------------- | ---------------------------------- |
| 会话启动     | 每次打开新对话             | 建立初始行为框架                   |
| 每次用户输入 | 每次发消息之前             | 强化规则，防止"漂移"回过度工程模式 |
| 子任务启动   | AI 创建子 agent 处理任务时 | 子 agent 也必须遵守规则            |
| 斜杠命令     | 用户输入 `/ponytail` 时    | 实时切换强度级别                   |

Claude Code 有个特殊问题：`SessionStart` hook 注入的上下文**不会被传递给子 agent**。也就是说，当你让 AI 处理一个复杂任务时，它派出去的"帮手"是完全不知道 ponytail 规则的，会重新开始写那个 80 行的 EmailValidator——这等于白装了。

ponytail 专门用一个 `SubagentStart` hook 解决了这个问题：每次创建子 agent 时，把同样的规则集再注入一次。一针见血。

### 3.2 多平台适配

ponytail 支持 Claude Code、CodeBuddy、Copilot、Hermes、OpenCode、Pi 等七八个 AI 编程平台。每个平台的注入机制不一样——有的是 hook，有的是 plugin，有的是 MCP server。但所有平台的注入内容都来自同一个文件：`skills/ponytail/SKILL.md`，就是上面那 120 行 Markdown。

```
所有平台 ──→ 同一个 SKILL.md ──→ 同一个 getPonytailInstructions() 函数
```

**一处修改，所有平台生效。** 这才是提示词工程的正确做法——不是到处复制粘贴 prompt，而是把 prompt 当作代码来管理。有版本控制、有回滚能力，和把 prompt 写在 ChatGPT 对话框里完全是两种工程水平。

---

## 四、强度分级：不是一刀切

强制所有任务都"偷懒"显然不合理。有时候我们确实需要写完整的代码，有时候我们只想让 AI 提一嘴"其实有更简单的做法"。

ponytail 设计了三个强度级别：

| 级别             | 心态                 | 效果                                                    |
| ---------------- | -------------------- | ------------------------------------------------------- |
| **lite**         | "你做你的，我提一嘴" | 正常写代码，但在最后补一句"其实标准库的 X 可以一行搞定" |
| **full**（默认） | "阶梯强制执行"       | 严格按七级决策阶梯走，不通过检查就不写新代码            |
| **ultra**        | "YAGNI 极端分子"     | 删除优先于添加，质疑需求本身，能一行绝不两行            |

用一个具体的例子来感受下区别。当你对 AI 说"给 API 响应加个缓存"：

- **lite**: "好的，缓存加好了。顺便提一句，`functools.lru_cache` 一行就能覆盖这个场景，不需要手写缓存类。"
- **full**: "直接 `@lru_cache(maxsize=1000)` 搞定。跳过了缓存类、过期策略、配置项——等 `lru_cache` 不够用再说。"
- **ultra**: "没有 profiler 数据就不加缓存。真要加也是 `@lru_cache`。手写的 TTL 缓存类就是个 bug 农场。"

三档共享同一套规则文本，通过模式过滤实现——根据当前级别，自动裁剪 SKILL.md 中的示例和强度表格行。不是三份 prompt，而是一份 prompt 的三个视图。这个设计的妙处在于维护成本几乎为零。

---

## 五、安全底线：什么绝对不能偷懒

每次我跟别人聊 ponytail，对方的第一反应几乎都是："让 AI 写得更少？那重要的东西不会也省掉了吗？"

放心，规则集里有一条明确的**红线**，列出了**绝不偷懒的领域**：

1. **信任边界的输入校验** —— 来自用户、来自 API、来自任何不受信任来源的数据，必须验证
2. **防止数据丢失的错误处理** —— 数据库操作、文件写入的异常处理不能省略
3. **安全措施** —— 权限检查、SQL 注入防护、XSS 防御，一律保留
4. **无障碍访问** —— `aria-label`、键盘导航、语义化 HTML，不能丢
5. **用户显式要求的任何东西** —— 你说了要，我就不能自作主张帮你"优化"
6. **真实硬件的校准需求** —— 物理世界的时钟会漂移、传感器有误差，这些校准逻辑不能偷懒

这些约束是硬编码在规则里的，不受强度级别影响。**即使你在 ultra 模式下，安全检查也必须完整保留。** 这是 ponytail 和裸 prompt"写最少的代码"最本质的区别——后者真的会为了"少"而跳过安全逻辑。

还有一个很巧妙的设计：**非平凡逻辑必须留下一个可运行的验证。** 可以是一个 assert 自检，也可以是一个迷你测试文件。不是让你写完整的测试套件——那本身就是过度工程——而是"你写的代码能不能跑，自己先证明一下"。

---

## 六、如何使用：零配置，一个命令

ponytail 的设计哲学同样贯彻到了安装流程——**尽可能简单**。不需要配置文件，不需要 API key，不需要注册任何账号。它就是个 npm 包，装完即用。

### 6.1 安装

不同平台安装方式略有不同，但复杂度都控制在"一个命令 + 重启"以内：

| 平台                   | 安装方式                                                                                                                                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CodeBuddy**          | 官方尚未支持，但我已适配，正在PR。在 CodeBuddy 命令行中执行：`/codebuddy plugin marketplace add https://github.com/studyzy/ponytail` 即可安装。重启 CodeBuddy 后会看到 Hook SessionStart 输出 `PONYTAIL MODE ACTIVE — level: full`，表示安装成功。 |
| **Claude Code**        | `/plugin marketplace add DietrichGebert/ponytail` 然后 `/plugin install ponytail@ponytail`                                                                                                                                                         |
| **Codex**              | `codex plugin marketplace add DietrichGebert/ponytail`，然后在 `/plugins` 界面安装                                                                                                                                                                 |
| **GitHub Copilot CLI** | `copilot plugin marketplace add DietrichGebert/ponytail && copilot plugin install ponytail@ponytail`                                                                                                                                               |
| **Gemini CLI**         | `gemini extensions install https://github.com/DietrichGebert/ponytail`                                                                                                                                                                             |
| **OpenCode**           | 在 `opencode.json` 里加一行 `{ "plugin": ["@dietrichgebert/ponytail"] }`                                                                                                                                                                           |
| **Pi**                 | `pi install git:github.com/DietrichGebert/ponytail`                                                                                                                                                                                                |
| **Hermes**             | `hermes plugins install DietrichGebert/ponytail --enable`                                                                                                                                                                                          |

对于 Cursor、Windsurf、Cline、Aider、Kiro、Zed 这类没有插件系统的编辑器，直接复制规则文件到对应目录即可（比如 `.cursor/rules/ponytail.md`），一样生效。

> **注意**：前置依赖只有一个——**Node.js**。因为 ponytail 的生命周期 hooks 是 JavaScript 写的。不需要 Docker，不需要 Python，不需要数据库。就这么简单。

### 6.2 激活与开关

安装完成后，ponytail **默认处于激活状态**，强度为 `full`。你不需要做任何额外配置——每次打开新对话，ponytail 会自动把规则集注入到 AI 的上下文中。

打开 AI 工具时你会看到一行醒目的提示：`PONYTAIL MODE ACTIVE — level: full`，这说明规则已经成功加载。看到这行字，就可以放心开始了。

### 6.3 切换强度

ponytail 的强度是实时可调的。不需要改配置文件，不需要重启，在对话中直接输入命令即可：

```
/ponytail lite     → "你做你的，我提一嘴更简单的方案"
/ponytail full     → "阶梯强制执行"（默认）
/ponytail ultra    → "YAGNI 极端主义"
/ponytail off      → 暂时关闭，回到正常模式
```

不带参数输入 `/ponytail` 会显示当前模式和强度。切换立即生效，从下一句对话开始，AI 就会按照新的强度级别行为。

### 6.4 设置默认强度

如果你有明确的偏好，不想每次都手动切换，可以通过两种方式设置全局默认值：

1. **环境变量**（优先级最高）：`export PONYTAIL_DEFAULT_MODE=ultra`
2. **配置文件**：在 `~/.config/ponytail/config.json` 里写 `{ "defaultMode": "lite" }`

不设置的话默认就是 `full`，以我的经验，这对大多数人来说是最合适的选择——既不会激进到影响正常工作，又足够有效地抑制过度工程。

### 6.5 子命令

ponytail 不只是"写少点代码"这一招。它还配了一套实用的子命令：

| 命令               | 作用                                                         |
| ------------------ | ------------------------------------------------------------ |
| `/ponytail-review` | 审查当前改动中是否有过度工程，给你一个"可以删掉"的清单       |
| `/ponytail-audit`  | 扫描整个仓库，找出所有过度工程的地方，相当于代码的"减肥体检" |
| `/ponytail-debt`   | 列出代码里所有 `ponytail:` 注释标记的技术债及其升级路径      |
| `/ponytail-gain`   | 展示 ponytail 带来的量化收益——省了多少代码、成本和时间       |
| `/ponytail-help`   | 命令速查表，随时查看所有可用命令                             |

这些子命令让 ponytail 的能力从"写代码时防过度工程"扩展到"审查代码 + 管理技术债 + 量化收益"——它不再只是一个提示词，而是一套**持续改善代码质量的工具链**。

### 6.6 卸载

如果哪天你觉得不需要了，卸载也很干脆：

```
Claude Code:    /plugin remove ponytail
CodeBuddy:      /plugin remove ponytail
Codex:          codex plugin remove ponytail
Pi:             pi uninstall ponytail
其他编辑器:     删除复制过去的规则文件即可
```

卸载后 ponytail 不会留下任何痕迹——没有残留配置，没有后台进程。它本质上就是个文件包，删了就没了。

---

## 七、量化效果：不是玄学

ponytail 的效果经过了系统化的 benchmark 验证，不是靠感觉吹出来的。基准测试的设计相当严谨：**三个对照臂**（无 skill / caveman / ponytail）、**三种模型**（Claude Haiku/Sonnet/Opus）、**五个日常任务**（邮箱验证、JS 防抖、CSV 求和、React 倒计时、FastAPI 限流），**每个单元跑 10 次取中位数**。

| 指标     | 效果        |
| -------- | ----------- |
| 代码量   | 减少 80-94% |
| API 成本 | 降低 42-75% |
| 执行速度 | 快 3-6 倍   |
| 安全检查 | 零遗漏      |

更有说服力的是 **agentic benchmark**——不是简单的单轮 API 调用，而是在**真实的 Claude Code session 中，让 AI 实际去编辑真实开源仓库**。这意味着测试的是"AI 真实工作时的表现"，而不是"AI 回答一个问题时的表现"。

结果让人印象深刻：

- **过度构建的任务**（比如让你加个"搜索框"，裸 AI 写了个带虚拟滚动、防抖、高亮的搜索组件）：ponytail 模式下**减少 60-94% 的代码**
- **已经是合理最小实现的任务**：ponytail **不会强行压缩**已经很简洁的代码，不会为了"少"而牺牲正确性
- **安全性：100% 通过**。有意思的是，裸 prompt"写最少的代码"反而只有 95% 的安全通过率——因为它在"偷懒"时会把安全检查也一起省掉。ponytail 不会，这是它和 naive 版本最本质的区别

---

## 八、ponytail 与 Caveman：一对黄金搭档

如果你关注过 AI 编程的提示词工程，应该听说过 **Caveman**——另一个在 GitHub 上走红的 Claude Code 技能。很多人问我：ponytail 和 Caveman 有什么区别？该用哪个？能不能一起用？

### 8.1 它们做的是完全不同的事

用一句话说清楚：

|              | ponytail                                   | caveman                               |
| ------------ | ------------------------------------------ | ------------------------------------- |
| **目标**     | 压缩代码                                   | 压缩文字                              |
| **管什么**   | AI 写什么代码                              | AI 怎么说话                           |
| **核心手段** | 决策阶梯（YAGNI → stdlib → native → 一行） | 去掉冠词/填充词/客套话                |
| **效果**     | 代码少 54-94%，成本降 20-75%               | token 减少 ~75%，表达更紧凑           |
| **安全问题** | 硬编码底线，绝不省安全检查                 | 安全警告/不可逆操作时自动恢复完整句式 |

举个直观的例子：

- ponytail 的回答：`<input type="date">` 一行替代整个日期选择器库
- Caveman 的回答：把 "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..." 压缩成 "Bug in auth middleware. Token expiry check use `<` not `<=`. Fix:"

**ponytail 管"写什么"，caveman 管"怎么说"。两者解决的是完全不同的问题。**

### 8.2 Benchmark 数据说话

ponytail 的 benchmark 明确把 caveman 作为对照臂，跑了几百次实验。以下是 agentic benchmark 的关键数据（真实 Claude Code session，12 个功能任务，Haiku 4.5，n=4）：

| vs no-skill baseline |      LOC |   tokens |     cost |     time |     safe |
| -------------------- | -------: | -------: | -------: | -------: | -------: |
| **ponytail**         | **-54%** | **-22%** | **-20%** | **-27%** | **100%** |
| caveman              |     -20% |      +7% |      +3% |      +2% |     100% |
| "YAGNI + one-liners" |     -33% |     -14% |     -21% |     -30% |      95% |

几个值得注意的结论：

1. **ponytail 在所有指标上都是最优。** 代码量、token 消耗、API 成本、执行时间，全面领先。
2. **caveman 在代码量上也有改善（-20%），但 token 和成本反而上升了。** 这印证了一个关键事实：caveman 压缩的是 prose（解释文字），不是代码本身。当 AI 的文字变短了，它并没有少写代码——只是说得更短。而 caveman 自身的提示词也要消耗 token，总成本反而略高。
3. **安全性：ponytail 和 caveman 都是 100%。** 但裸 prompt"写最少的代码"只有 95%——它真的会把安全检查一起"优化"掉。
4. **caveman 对纯文字型回复有优势。** 如果你的 AI 主要在"解释问题"而不是"写代码"，caveman 的 prose 压缩能力是 ponytail 不具备的。反过来，如果你的 AI 主要在写代码，ponytail 的收益远超 caveman。

### 8.3 是否可以同时开启？

**可以。而且 ponytail 的作者就是这么设计的。**

ponytail 的 SKILL.md 里有一行明确的边界声明：

> "Ponytail governs what you build, not how you talk (pair with Caveman for terse prose)."

翻译过来就是："ponytail 管你写什么，不管你怎么说话（搭配 Caveman 来压缩文字）。"

两者的作用域完全正交——ponytail 改变代码生成行为，caveman 改变文字输出风格。同时开启时，AI 会在"写更少的代码"的同时"用更少的词解释它"。benchmark 数据也证实两者不会产生冲突。

实际上，同时开启 **ponytail full + caveman full** 可能是最优解：

- ponytail 确保代码最小化、不过度工程
- caveman 确保解释文字精炼、不废话
- 两者叠加，token 节省效果互相放大，总成本更低

不过有个小提醒：同时开两个技能意味着每次对话都要读两份 SKILL.md，会增加约 2-3k token 的系统提示词固定开销。对于短对话来说，这个固定开销可能吃掉一部分节省；但对于长对话，尤其是 agentic 任务，这个开销被摊薄后几乎可以忽略不计。

---

## 九、提示词工程的启示

ponytail 本质上是一个提示词工程的实验。它的成功指向几个反直觉的结论，我认为对任何在写 prompt 的人都很有参考价值。

### 9.1 好 prompt 不是"说得更清楚"，而是"改变思维模式"

大部分提示词工程的目标是"让 AI 更准确地理解你的需求"。ponytail 做的是**让 AI 换一种方式思考**——不是"我该怎么实现这个需求"，而是"**这个需求真的需要实现吗**"。

这两者的区别，就像"教一个人更好地砍树"和"让他先想清楚这棵树该不该砍"。

### 9.2 约束 > 指令

"写最少的代码"是一个指令。"先检查标准库有没有、再检查已安装依赖有没有、再检查原生平台功能有没有"是一个**约束**。

指令会被 AI 用它的方式解读，解读的结果往往不可控。约束改变了它处理信息的方式——它不是在"理解你的要求后尽量满足"，而是在"每个决策节点上被硬性规则拦住"。后者的效果稳定得多。

### 9.3 prompt 应该像代码一样管理

ponytail 的 SKILL.md 是**唯一真源**。所有平台共享同一份。修改一处，全局生效。有 Git 版本控制，有回滚能力。

这和我们把 prompt 写在 ChatGPT 对话框里、写在本地的 `.txt` 文件里、写在团队的 Notion 文档里，完全是两种工程水平。如果你在认真做 prompt engineering，**你的 prompt 应该有 repo，有 version history，有 changelog**。

### 9.4 输出约束和输入约束同样重要

ponytail 不仅管 AI"怎么想"，还管 AI"怎么说"。

规则集里有一行看似不起眼但杀伤力极大的约束："代码优先，最多三行解释。解释比代码长就删掉解释。" 这句话堵死了 AI 最后一条过度工程的路——它不能再写 50 行代码然后用 80 行注释来解释"为什么这么写"。因为解释本身，就是复杂度的二次走私。

### 9.5 让简化看起来是"意图"而非"无知"

`ponytail:` 注释约定，我认为是整个设计中最精妙的部分之一。

当 AI 写了一个全局锁而不是细粒度锁时，它会被要求加上注释：`# ponytail: 全局锁，如果吞吐量成为瓶颈则换 per-account 锁`。

这一行注释的价值不可低估——它把"可能写错了"变成了"**我知道这里简化了，这是升级路径**"。code review 时看到这行注释，不会觉得是 bug，而是理解这是一个**有意的、有出口的取舍**。这让"简单"从可疑变成了可信。

---

## 十、总结

ponytail 用 120 行 Markdown 规则集，实现了让 AI 少写 90% 代码的效果。它的核心不是魔法，而是一套经过精心设计和量化验证的提示词工程：

1. **决策阶梯** —— 把"写代码"从第一反应变成最后选择
2. **多层注入** —— 确保规则在所有场景、所有子任务、所有平台上都稳定生效
3. **强度分级** —— 适应不同的使用场景和风险偏好，不搞一刀切
4. **安全底线** —— 明确定义"绝对不能省"的边界，这是它和 naive 方案的本质区别
5. **量化验证** —— 用系统化 benchmark 证明效果，不靠感觉，不靠吹嘘

它证明了一件我认为非常重要的事：**给 AI 一个好的思维框架，比给它一个详细的实现指令有效得多。**

### 给 CodeBuddy 用户的建议

如果你使用 CodeBuddy **主要用于代码开发**，我建议全局安装并开启 ponytail。安装很简单，在 CodeBuddy 命令行下执行：

```
/codebuddy plugin marketplace add https://github.com/studyzy/ponytail
```

重启 CodeBuddy 后，看到 `Hook SessionStart` 输出 `PONYTAIL MODE ACTIVE — level: full` 就说明成功了。日常编码中，ponytail 会自动帮你减少冗余代码、节省 token 开销——你会逐渐习惯那种"话不多但句句到位"的 AI 交互风格。

如果你平时除了写代码还要**写文档、做方案设计、写非技术内容**，建议采用"按项目开启"的策略：

- **全局保持默认关闭。** 不在全局安装 ponytail，避免写文档时决策阶梯误触发，让 AI 把方案设计也"精简"了。
- **在源码仓库中按需开启。** 在具体的代码项目里安装 ponytail，让它在需要的时候才生效。
- 或者全局安装但默认设为 `off`，进入代码项目时再 `/ponytail full` 打开。

这样写代码时有 ponytail 帮你精简，写文档时 AI 保持完整的表达力，两者互不干扰，token 使用也更加经济。

### 与 Caveman 搭配的建议

如果你追求极致的 token 效率，我强烈推荐同时开启 ponytail + caveman：

- ponytail 压缩代码（实测少写 54% 代码）
- caveman 压缩文字（实测节省 75% prose token）
- 两者作用域正交，互不冲突，ponytail 作者自己也推荐这个组合

---

### 欢迎讨论

ponytail 是一个还在快速迭代的开源项目。如果你用了之后有独特的体验——无论是觉得它帮你省了一大笔 API 费用，还是觉得它在某个场景下"懒过头了"——都欢迎在评论区分享。**尤其是踩坑的经历**，对作者改进规则集是极有价值的反馈。

我个人的体会是：ponytail 不会让 AI 变得更聪明，但它让 AI 不再用"假装勤奋"来掩盖"没有深度思考"。而这，可能就是我们真正需要的。

---

_ponytail 是开源项目，GitHub: [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)_

_CodeBuddy 适配版: [studyzy/ponytail](https://github.com/studyzy/ponytail)_
