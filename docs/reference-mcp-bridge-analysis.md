# mcp-bridge 参考仓库分析与解构

## 0. 文档信息

- 参考仓库：`tmp/reference/mcp-bridge`
- 分析对象：Chrome Extension 端为主，结合配置文档、用户手册、开发文档和核心源码
- 输出文件：`docs/reference-mcp-bridge-analysis.md`
- 目标用途：为本项目后续 PRD、架构设计、功能拆分、验收用例和实现路线提供可复用参考
- 分析日期：2026-04-26

已阅读的关键材料包括：

- `README.md`
- `manifest.json`
- `config/api_list.json`
- `modules/api_client.js`
- `modules/prompt_builder.js`
- `modules/input_injector.js`
- `scripts/content_script.js`
- `scripts/page_world/fetchhook.js`
- `scripts/page_world/injector.js`
- `ui/status_panel.js`
- `docs/ARCHITECTURE.md`
- `docs/FALLBACK_MECHANISMS.md`
- `docs/CACHE_FEATURE.md`

---

## 1. 总体判断

`mcp-bridge` 不是一个简单的 userscript demo，而是一个较完整的 Chrome Extension + 本地桥接服务方案。它的核心价值不在于单个工具调用，而在于把“多 AI 平台适配”“Prompt 注入”“响应解析”“工具调用检测”“状态面板”“配置页”“服务管理”“缓存/分页读取”整合成了一套可产品化的浏览器扩展体验。

对本项目最有参考价值的部分主要有七类：

1. **Chrome Extension 正式形态**：MV3、background service worker、content script、page world script、popup、options page、web accessible resources 的完整组合。
2. **站点适配配置化**：通过 `config/api_list.json` 把平台 API、promptPath、响应路径、UI 解析、输入框注入和新会话判断都配置化。
3. **Page World / Content Script / Background 分层**：网络 hook 放在页面主世界，DOM/UI/input 放在 content script，工具调用和状态机放在 background。
4. **四层 fallback 机制**：API 解析、UI DOM 解析、重新检测、手动输入共同构成兜底链路。
5. **状态面板体验**：常驻浮窗、Shadow DOM 样式隔离、重新检测、手动粘贴、执行状态、错误详情展示。
6. **大结果缓存模型**：结果过大时返回 cache_id，再通过搜索、取上下文、分段读取来处理。
7. **配置与服务管理 UI**：站点设置、端口设置、服务启停、重启、删除、配置合并等产品化能力。

它对本项目的启发不是“照搬多平台”，而是：即使我们坚持 ChatGPT Web 深度优先，也应该尽早把 adapter、fallback、diagnostics、cache、panel 和 options 这些结构抽象清楚。

---

## 2. 仓库结构解构

从已读取文件看，`mcp-bridge` 的浏览器端结构大致如下：

```text
mcp_bridge/
├── manifest.json
├── config/
│   └── api_list.json
├── modules/
│   ├── api_client.js
│   ├── prompt_builder.js
│   └── input_injector.js
├── scripts/
│   ├── background.js
│   ├── content_script.js
│   └── page_world/
│       ├── fetchhook.js
│       ├── ajaxhook.min.js
│       └── injector.js
├── ui/
│   └── status_panel.js
├── options/
│   └── options.js
└── popup/
    └── popup.js
```

各模块职责比较清晰：

| 模块 | 主要职责 | 对本项目的参考价值 |
|---|---|---|
| `manifest.json` | 声明 MV3 扩展能力、站点权限、脚本注入、popup、options | 后续从 userscript 迁移 Chrome Extension 的结构参考 |
| `config/api_list.json` | 多平台 adapter 配置 | 站点适配 schema 的直接参考 |
| `modules/api_client.js` | 封装本地 Bridge Server API | Gateway client 的抽象参考 |
| `modules/prompt_builder.js` | 构建工具系统提示词与工具结果反馈 | 模型工具协议 prompt 的参考 |
| `modules/input_injector.js` | 向现代网页输入框注入文本并触发提交 | ChatGPT Web 输入框注入的关键参考 |
| `scripts/page_world/*` | fetch/XHR hook、请求改写、响应监听 | request-layer injection 和 stream detection 的参考 |
| `scripts/content_script.js` | 消息桥接、DOM 解析、UI 面板、输入注入 | page/background 之间的隔离层参考 |
| `scripts/background.js` | 核心状态机、请求注入、响应解析、工具执行、fallback | Browser Layer 主流程参考 |
| `ui/status_panel.js` | Shadow DOM 状态浮窗 | v0.2 panel-side tool card / diagnostics 的参考 |
| `options/options.js` | 站点和服务配置管理 | Chrome Extension Options Page 参考 |
| `popup/popup.js` | 全局开关、健康检查、刷新 Prompt | 轻量控制入口参考 |

---

## 3. Chrome Extension 形态分析

### 3.1 Manifest V3 结构

`manifest.json` 使用 Manifest V3，核心声明包括：

- `permissions`：`storage`、`scripting`、`webNavigation`
- `host_permissions`：本地 `http://localhost:3849/*` 以及多个 AI Web 平台
- `background.service_worker`：`scripts/background.js`，且 `type: module`
- `content_scripts`：两组脚本
  - page world 脚本：`fetchhook.js`、`ajaxhook.min.js`、`injector.js`，`world: MAIN`
  - isolated content script：`scripts/content_script.js`
- `web_accessible_resources`：状态面板、确认框、输入注入模块
- `action.default_popup`：popup 控制中心
- `options_page`：配置页面

这说明它采用的是比较典型的扩展架构：

```text
Page World Script
  ↓ window.postMessage / hook fetch/XHR
Content Script
  ↓ chrome.runtime.sendMessage
Background Service Worker
  ↓ fetch localhost bridge
Local Bridge Server
```

### 3.2 双世界脚本设计

它把网络拦截脚本放在 `world: MAIN` 中，因为 fetch/XHR hook 需要进入页面主世界才能拦截目标站点自身发出的请求。再通过 content script 与 background 通信。

这个设计值得本项目后续 Chrome Extension 版本吸收：

- **Page World Script**：只做页面环境内必须做的事，例如 fetch/XHR hook。
- **Content Script**：做 DOM 解析、UI 注入、输入框操作、消息转发。
- **Background**：做权限判断、工具调用、状态管理、配置读取。

当前本项目 userscript 可以跑通验证，但长期还是应迁移为这种分层。尤其 ChatGPT Web 页面复杂，直接在一个 userscript 中塞入所有逻辑会越来越难维护。

### 3.3 postMessage 桥接方式

`injector.js` 使用 `window.postMessage` 将请求体、响应 chunk、响应完成事件发给 content script；content script 再用 `chrome.runtime.sendMessage` 发给 background。每个需要等待返回的请求会带上 `requestId`，content script 回传时再用同一个 `requestId` 匹配。

这对本项目的意义是：

1. Page World 里不要直接承担工具权限与业务逻辑。
2. Request 修改必须有超时与降级策略，避免阻塞目标网站正常请求。
3. 如果 extension context 失效，content script 应直接返回原始 body，避免破坏网页使用。

`content_script.js` 中已经体现了类似容错：当 `chrome.runtime` context 不可用时，对请求拦截消息直接返回原始 body，并提示用户刷新页面。这一点本项目迁移 Extension 时也应保留。

---

## 4. 站点适配配置化

### 4.1 `api_list.json` 的核心字段

`mcp-bridge` 最值得拆解的是 `config/api_list.json`。它把每个 AI 平台的适配规则变成配置，而不是写死在代码里。

典型字段包括：

| 字段 | 含义 |
|---|---|
| `name` | 平台唯一标识 |
| `hostname` | 匹配站点域名 |
| `label` | UI 显示名称 |
| `api` | 需要拦截的 API 路径片段 |
| `promptPath` | 用户输入在请求体中的路径，可为字符串或数组 |
| `isJsonString` | 目标字段是否是 JSON 字符串，需要二次解析 |
| `enabled` | 是否启用该平台 |
| `defaultAlwaysInject` | 是否默认每次注入提示词 |
| `response.type` | 响应类型，如 `sse` / `json` |
| `response.format` | SSE 数据格式 |
| `response.contentPaths` | 从响应中提取模型输出的路径 |
| `response.filterRules` | 响应过滤规则 |
| `uiParsing` | DOM 解析兜底配置 |
| `input` | 输入框选择器和提交策略 |
| `newConversationFlag` | 新对话判断规则 |
| `skipRequestModification` | 是否跳过请求改写，仅监听响应 |
| `onLoadTip` | 特定站点加载提示 |
| `promptFilter` | 自定义 prompt 提取逻辑 |
| `promptSetFilter` | 自定义 prompt 写回逻辑 |

这套配置的意义很大：它把平台差异收敛到了 adapter 层。

### 4.2 ChatGPT 配置的参考价值

它已有 ChatGPT 配置：

```json
{
  "name": "chatgpt",
  "hostname": "chatgpt.com",
  "api": [
    "/backend-api/conversation",
    "/backend-anon/conversation",
    "/backend-api/f/conversation"
  ],
  "promptPath": "messages.0.content.parts.0",
  "response": {
    "type": "sse",
    "contentPaths": [
      "message.content.parts.0",
      "delta.content",
      "content"
    ]
  },
  "input": {
    "selector": "#prompt-textarea",
    "submitKey": "Enter",
    "submitModifiers": [],
    "submitDelay": 1600
  }
}
```

这对本项目有两个启发：

1. ChatGPT Web 的 API 路径、请求体路径和 SSE 响应路径会变化，所以不能只依赖单一路径。
2. 即使本项目短期只支持 ChatGPT，也应该内部保留 adapter schema，这样后续应对 ChatGPT 路径变化更容易。

但也需要注意：`mcp-bridge` 的 ChatGPT 配置并不代表当前 ChatGPT Web 一定稳定可用。它在 README 中也将 ChatGPT 标为“适配中”。本项目不应直接拿这份配置作为最终事实，而应作为 adapter schema 与候选路径的参考。

### 4.3 `promptFilter` / `promptSetFilter` 的高级抽象

它支持以下 filter preset：

- `findByField`
- `findFirstMatch`
- `filterAndJoin`
- `getByIndex`
- `getPath`

对应 setter preset：

- `setByField`
- `setByIndex`
- `setPath`

这部分是为复杂请求体设计的。例如某个平台的用户文本不在固定路径，而是在 `messages` 数组中按 `mime_type=text/plain` 查找。这个能力不一定是本项目 v0.x 必做，但 schema 设计上值得保留扩展点。

建议本项目后续 adapter schema 分两层：

```text
P0: ChatGPT fixed adapter
P1: declarative adapter schema
P2: filter/setter preset
```

不要一开始就做完整多平台配置化，但要避免把 ChatGPT 路径写散在多个模块里。

---

## 5. Page World Hook 实现细节

### 5.1 fetch hook

`fetchhook.js` 保存原始 `window.fetch` 为 `window.RealFetch`，再用包装函数替换 `window.fetch`。它提供三类 hook：

- `urlHook`
- `optionsHook`
- `responseHook`

一个关键细节是：当 input 是 `Request` 对象时，它通过 `input.clone().text()` 读取 body，避免消费原始流。这对 request-layer injection 很重要，因为直接读取 Request body 可能导致原请求无法继续发送。

本项目如果迁移 Extension，应保留这个原则：

```text
读取请求体必须 clone / copy
修改失败必须回退原始 body
不要破坏原请求的 headers、credentials、signal 等属性
```

### 5.2 injector 请求改写

`injector.js` 的 `optionsHook` / XHR `onRequest` 流程：

```text
判断 URL 是否命中当前站点 api 配置
→ 若 skipRequestModification，则只监听响应，不改请求
→ 通过 postMessage 将 url/body 发给 content script
→ content script 转发给 background
→ background 返回 modifiedBody
→ 写回 fetch options.body 或 XHR config.body
```

这给本项目一个清晰约束：request-layer injection 的失败不应影响用户正常发送消息。即使注入失败，也应该让原请求继续走。

### 5.3 响应监听与解析

`injector.js` 同时监听 fetch 和 XHR：

- fetch 流式响应：用 `response.body.getReader()` 代理原始流，边读边把 chunk 传回页面消费者，同时把累积文本 postMessage 给 content script。
- fetch 非流式响应：clone response 后读取全文，发送 `FETCH_RESPONSE_COMPLETE`。
- XHR 响应：通过 ajaxhook 监听完整响应；另外再劫持 `XMLHttpRequest.prototype.open/send` 监听 `progress` 和 `readystatechange`。

其中 XHR progress 路径会调用配置化 `parseResponse()`，按 `contentPaths` 和 `filterRules` 抽取模型文本。fetch streaming 路径则更偏原始累积文本，发送阈值是“新增长度超过 100 或包含 `</tool_code>`”。

对本项目来说，这里有两点值得吸收：

1. **fetch 与 XHR 都要支持**：ChatGPT Web 当前主要依赖 fetch，但平台内部实现可能变化。
2. **解析逻辑应尽量统一**：`mcp-bridge` 的 fetch 和 XHR 路径解析一致性还不完全，后续本项目应把 stream parser 抽成单一模块，避免不同 hook 得到不同结构。

### 5.4 站点配置缓存位置

`injector.js` 通过 `localStorage.getItem('mcp_api_list')` 获取站点配置，而 content script 接收 `STORE_API_LIST` 后写入 localStorage。

这是一种简单有效的 page world 配置同步方式，但它也有边界：

- 配置暴露在页面 localStorage 可被页面脚本读到。
- 配置更新需要显式同步。
- 如果配置中未来包含敏感信息，绝对不能使用 localStorage 传递。

本项目可采用相同方式同步非敏感 adapter 配置，但 token、secret、权限策略不能进入 page world。

---

## 6. Content Script 层设计

### 6.1 核心职责

`content_script.js` 的职责比较典型：

1. 判断当前站点是否在 `api_list` 中。
2. 支持站点时创建常驻 `StatusPanel`。
3. 监听 page world 的 `postMessage`，转发给 background。
4. 接收 background 的 UI 更新、DOM 解析、文本注入请求。
5. 处理 status panel 发来的重新检测和手动输入消息。
6. 处理 extension context invalid 时的降级提示。

### 6.2 DOM 解析 fallback

`parseUIContent(uiConfig)` 支持：

- `messageContainer` 为字符串或数组。
- 合并多个 selector 的结果。
- 去重。
- 按 DOM 顺序排序。
- 支持负数索引，如 `-1` 表示最后一条消息。
- 支持 `contentSelector` 为字符串或数组。
- 使用 `innerText || textContent` 提取文本。

这对本项目非常实用。建议后续 ChatGPT DOM fallback 采用类似接口：

```json
{
  "messageContainer": ["[data-message-author-role='assistant']", "article"],
  "messageIndex": -1,
  "contentSelector": [".markdown", "[data-message-content]"]
}
```

不过要注意：DOM fallback 应只作为兜底来源，且所有检测结果都应归一化成同一个 `ToolCallBatch`，避免 stream / complete / DOM / manual 四条路径各写一套执行逻辑。

### 6.3 输入注入入口

content script 接收 background 的 `INJECT_TEXT_AND_SUBMIT`，动态导入 `modules/input_injector.js` 并调用 `injectTextAndSubmit()`。

这个分层很好：background 不直接碰 DOM；content script 负责页面交互。后续本项目迁移 Extension 时也应这样划分。

---

## 7. Browser 主流程解构

`background.js` 是核心控制器。虽然本轮没有再次完整读取它，但结合架构文档、已读取模块和 README，可以还原其主流程。

### 7.1 安装与初始化

安装或更新时：

1. 读取扩展内置的 `config/api_list.json`。
2. 存入 `chrome.storage.local`。
3. 设置默认开关：`mcp_enabled: true`、`always_inject: {}`。

这相当于把站点配置作为可更新的本地状态，而不是每次都读静态文件。

本项目后续可以类似处理：

- 内置默认 ChatGPT adapter。
- 用户可在 Options 中查看/重置 adapter。
- 出问题时可导出当前 adapter 配置用于诊断。

### 7.2 页面加载时分发配置

它监听 `chrome.webNavigation.onCompleted`，页面加载完成后把 `api_list` 发送给 content script。

这个动作让 content script 能在页面侧做 UI parsing 和 input injection，也让 page world 能通过 localStorage 获取非敏感站点配置。

本项目可参考，但要注意配置更新后的同步问题：

- Options 修改 adapter 后，需要通知当前 tab 更新配置。
- 诊断面板应显示当前 tab 使用的是哪个 adapter version。

### 7.3 请求体处理与 Prompt 注入

`handleRequestBody` 是 request-layer 注入的主流程：

```text
收到 page hook 转发的请求体
→ 检查 mcp_enabled
→ 获取 tab state
→ 匹配 siteConfig
→ 判断是否 skipRequestModification
→ 解析 JSON body
→ 判断是否新对话 / 是否 always inject
→ 获取服务列表
→ 构建 initialPrompt 或 reminderPrompt
→ 按 promptPath / promptFilter 注入
→ 设置 tab state 为 AWAITING_RESPONSE
→ 返回 modifiedBody
```

这套链路的关键点是：Prompt 注入不是直接操作输入框，而是在请求发出前改写 request body。这比“复制一段系统提示词到输入框”更隐蔽也更强，但也更依赖站点内部 API 结构。

对本项目来说，后续要明确两条路径：

| 路径 | 说明 | 定位 |
|---|---|---|
| request-layer injection | 拦截 ChatGPT 请求体并注入 catalog | 主路径 |
| input-box injection | 向输入框插入工具说明或工具结果 | fallback / result feedback |

### 7.4 响应解析与工具调用检测

它同时处理：

- `FETCH_RESPONSE_CHUNK`
- `XHR_RESPONSE_CHUNK`
- `FETCH_RESPONSE_COMPLETE`
- `XHR_RESPONSE_COMPLETE`

工具调用格式使用 `<tool_code>...</tool_code>`，正则做了容错：

```text
<?\s*tool_code\s*>? ... <\s*/\s*tool_code\s*>
```

这说明它考虑到 SSE token 边界或解析缺字符的情况，允许起始 `<` 或结束 `>` 不完整。

工具调用检测后会生成 `toolCallKey`：

```text
JSON.stringify({ tool_name, arguments })
```

并用 `currentToolCallKey` + `resultInjected` 防重复执行。

本项目当前 batch 工具调用已有 `callId` 和 `messageId`，后续 fallback 去重建议更强一些：

```text
conversationId + assistantMessageId + normalizedJsonHash + toolIndex
```

这样比只用工具名和参数更稳，尤其是同一回复中多个相同工具调用时。

### 7.5 UI DOM fallback

在 response complete 阶段，如果配置了 `uiParsing`，会根据 `priority` 决定是否使用 DOM 解析：

- `priority=ui`：直接用 UI 解析结果替换 API 文本。
- `priority=api`：只有 API 文本为空时才尝试 UI。

这对应了一种很实用的产品经验：不同平台的 API 响应解析稳定性不同，不能假设 API 一定比 DOM 更可靠。

本项目对 ChatGPT Web 可以采用类似分层：

```text
stream parser
→ complete response parser
→ DOM parser
→ startup rescan
→ manual paste
```

但所有来源都必须归一化为同一个 `ToolCallBatch`，不能每条链路写一套执行逻辑。

### 7.6 手动重新检测与手动粘贴

状态面板提供两个重要 fallback：

1. 重新检测最后一条 UI 消息。
2. 手动粘贴包含 `<tool_code>` 的内容。

这两个能力对真实用户很重要，因为 Web AI 页面经常出现：

- 请求拦截没命中。
- SSE 响应解析失败。
- 页面刷新后状态丢失。
- 模型输出了工具调用但脚本没捕获。

本项目 v0.2 应该尽早提供对应能力：

```text
Redetect last assistant message
Manual paste mcp block
Copy last tool result
Copy diagnostics
```

---

## 8. 四层保障机制分析

`docs/FALLBACK_MECHANISMS.md` 将可靠性明确拆成四层：

| 层级 | 触发方式 | 优势 | 劣势 | 对本项目启发 |
|---|---|---|---|---|
| API 解析 | 自动 | 最快、实时、无 DOM 等待 | SSE chunk、格式变化、调试困难 | stream parser 主路径 |
| UI DOM 解析 | 自动兜底 | 高成功率、易调试 | 依赖页面 DOM、等待渲染 | complete/stream 失败后的自动 fallback |
| 重新检测 | 用户点击 | 页面刷新后可恢复 | 需要用户触发 | v0.2 必做 |
| 手动输入 | 用户粘贴 | 最高可靠性 | 操作繁琐 | v0.2 必做最终兜底 |

文档中声称不同平台 API 解析成功率约 60–80%，UI DOM 解析可达 90–99%。这些数字更像项目经验值，不应直接作为本项目指标，但其方向可信：真实 Web 平台必须设计多层 fallback。

本项目建议将 fallback 明确写入 PRD 状态机：

```text
request_hook_active
→ catalog_injected
→ stream_observed
→ tool_call_detected_from_stream
→ tool_call_detected_from_complete_response
→ tool_call_detected_from_dom
→ redetect_requested
→ manual_paste_received
→ normalized_batch_created
→ permission_checked
→ execution_pending
→ executing
→ result_ready
→ result_inserted
→ result_sent
→ completed / failed
```

注意：这条状态机不是为了复杂化，而是为了避免“工具执行到底从哪个路径触发”变成不可观察黑箱。

---

## 9. Prompt 与模型协议设计

### 9.1 分层式工具发现

`prompt_builder.js` 的初始 Prompt 不直接把所有工具一次性暴露给模型，而是先展示服务列表，再让模型调用 `list_tools_in_service` 获取某个服务下的工具详情。

其流程是：

```text
先判断是否需要工具
→ 选择服务
→ 调 list_tools_in_service
→ 根据工具列表调用具体工具
→ 工具结果回填后继续回答
```

这是一种“分层工具发现”策略，优点是减少初始 prompt 体积，适合外部 MCP server 较多的场景。

本项目当前工具数量少，可以继续直接暴露工具列表。但一旦进入外部 MCP adapter 阶段，就需要类似机制：

```text
builtin 工具：可直接暴露核心低风险工具
external MCP server：先暴露 server/service 摘要，再按需 list tools
```

### 9.2 工具结果反馈格式

普通工具结果会被包成：

```text
# 工具执行结果
工具名称: ...
执行结果: JSON...
现在，请基于以上工具执行结果继续回答。
```

错误结果会被包成：

```text
# 工具执行失败
工具名称: ...
错误信息: ...
请分析错误原因，可以修正参数后重试。
```

大结果会被包成缓存引用，并明确告诉模型下一步可调用：

- `search_cached_result`
- `get_cache_context`
- `get_cached_result`

本项目的 `tool_result_batch` 回填也应该类似：不仅给结果，还要给模型一个清晰的下一步协议，尤其是大结果、错误、被截断、权限阻断等场景。

### 9.3 XML 标签与 fenced JSON 的取舍

它使用：

```xml
<tool_code>
{
  "tool_name": "...",
  "arguments": {}
}
</tool_code>
```

本项目使用 fenced `mcp` JSON block，这比 XML 标签更适合 ChatGPT Web，因为：

- 更接近代码块解析。
- 不容易和普通文本混淆。
- 可以天然支持 batch。
- 更符合当前项目已经验证的路线。

但仍可借鉴它的“工具调用必须处于回复末尾”规则，降低解析复杂度。

---

## 10. 输入注入机制分析

`modules/input_injector.js` 是非常有参考价值的实现。它不是简单设置 `element.value`，而是针对 React/Vue/contenteditable 做了兼容。

### 10.1 查找输入框

查找顺序：

1. 使用配置中的 selector。
2. 遍历 Shadow DOM。
3. 使用 fallback selectors：
   - 中文 placeholder textarea
   - 普通 textarea
   - `[contenteditable="true"]`
   - `input[type="text"]`

这说明实际平台输入框非常不稳定，需要 fallback。

本项目 ChatGPT Web 可先专注 `#prompt-textarea`，但需要保留 fallback：

```text
#prompt-textarea
[contenteditable="true"]
textarea
```

### 10.2 contenteditable 注入

对 contenteditable，它做了：

1. focus。
2. selectNodeContents。
3. 触发 `beforeinput`。
4. 尝试 `document.execCommand('insertText')`。
5. fallback 到 `textContent`。
6. 将光标移动到末尾。
7. 触发 `input`、`change`、`keydown`、`keyup`。

这个组合说明现代网页输入框不能只改 DOM 值，必须模拟用户输入事件，否则框架状态不会更新。

本项目后续的 ChatGPT Web result insertion 应该重点复用这一思路。

### 10.3 自动提交策略

它按 `submitDelay` 拆分成多个阶段：

- afterFocus
- afterInput
- beforeSubmit
- afterSubmit

再模拟 `keydown` / `keypress` / `keyup`。

不过它主要依赖按键提交。对 ChatGPT Web，本项目已经观察到 send button 可能更稳定。因此建议本项目采用：

```text
优先：点击 send button
备选：模拟 Enter
再备选：只插入不发送，提示用户手动发送
```

并把每一步记录到 diagnostics。

---

## 11. 状态面板 UI 分析

### 11.1 Shadow DOM 隔离

`StatusPanel` 使用 Shadow DOM，避免页面样式污染。这一点非常值得参考。

ChatGPT Web 页面 CSS 复杂，后续如果本项目做 panel / card / badge，应优先采用：

```text
Shadow DOM + isolated stylesheet
```

### 11.2 常驻浮窗能力

状态面板特性包括：

- 常驻显示。
- 默认展开，可折叠。
- 可最小化。
- 可拖拽。
- 位置存入 localStorage。
- 最小化状态存入 localStorage。
- idle 状态淡化。
- 错误时自动展开。
- 重新检测按钮。
- 手动发送消息按钮。
- 详情折叠区。
- HTML escape 防止详情区 XSS。

这说明它把“工具调用可见性”做成了产品体验，而不是只在 console 打日志。

本项目 v0.2 的 panel-side tool card 可以借鉴：

```text
Panel Header
  - Gateway connected / disconnected
  - current workspace
  - last injection status
  - redetect button
  - manual paste button
Body
  - pending tool calls
  - running tools
  - results
  - errors
  - copy diagnostics
```

### 11.3 当前面板的不足

它仍然偏“状态浮窗”，不是完整工具卡片系统。每次 update 会重写 body，适合显示一个当前状态，但不适合保存多条工具调用历史。

本项目不应完全照搬，而应该升级为：

```text
ToolCallCard[]
ResultCard[]
ErrorCard[]
ProposalCard[]
DiagnosticsCard
```

每个 card 都有独立状态、复制、重试、插入、展开详情等操作。

---

## 12. Popup 与 Options Page 分析

### 12.1 Popup

`popup.js` 提供轻量控制入口：

- 全局启用/禁用 MCP。
- 自动提交 Prompt 开关。
- 检查本地 Bridge Server 健康状态。
- 刷新 System Prompt。
- 打开 Options Page。
- 检查远程版本。

对本项目的启发：Popup 应该只放高频、低复杂度控制，不要把复杂工具权限和日志塞进去。

建议本项目 Popup：

```text
- Gateway connected / disconnected
- Current workspaceRoot
- Enable bridge
- Auto execute low-risk tools
- Auto insert result
- Auto send result
- Open Side Panel / Options
- Copy diagnostics
```

### 12.2 Options Page

`options.js` 比 popup 复杂得多，覆盖：

- 端口配置。
- 站点自动注入开关。
- 服务列表。
- 服务运行状态检测。
- 服务重启。
- 服务删除。
- 服务启用/禁用。
- 配置读取。
- 配置保存。
- 配置合并。
- 多种 JSON 配置格式识别。

这对本项目 Chrome Extension 版本很有价值。尤其是配置合并逻辑：用户可能从不同来源复制 MCP server 配置，不一定都是完整格式。因此 Options Page 需要支持：

1. 完整配置：`{ mcpServers: {...} }`
2. 单服务配置：`{ command, args }`
3. 多服务对象：`{ serverA: {...}, serverB: {...} }`

但本项目必须比它更严格处理敏感字段：

- env 中的 token 必须脱敏展示。
- 保存前做 schema 校验。
- 高风险 server 默认 disabled。
- 外部工具默认不向模型暴露。

---

## 13. 大结果缓存机制

### 13.1 设计目标

`mcp-bridge` 的缓存设计用于解决大文件、大日志、大搜索结果不能直接塞回模型的问题。

当结果超过阈值时，会返回：

```json
{
  "success": true,
  "result_type": "cached_reference",
  "cache_id": "uuid-string",
  "cache_type": "memory 或 file",
  "total_size": 30520,
  "message": "结果过大，已缓存"
}
```

之后模型可以调用：

| 工具 | 作用 |
|---|---|
| `search_cached_result` | 在缓存中搜索关键词 |
| `get_cache_context` | 获取指定行附近上下文 |
| `get_cached_result` | 按字符范围分段读取 |

### 13.2 缓存参数

`docs/CACHE_FEATURE.md` 中给出的默认设定：

- 超过默认 1000 字节触发缓存。
- 结果 ≤ 10KB 用内存缓存。
- 结果 > 10KB 用文件缓存。
- TTL 默认 5 分钟。
- 搜索接口支持大文件流式搜索。

这些值不一定适合本项目，但机制很值得吸收。本项目面向开发仓库，日志和 grep 输出很容易超过几万字符，必须避免直接回填到 ChatGPT 输入框。

### 13.3 本项目推荐版本

本项目可以比 `mcp-bridge` 更工程化一些：

```text
Tool result over threshold
→ summarize top-level metadata
→ save cache with resultId
→ return summary + suggested next tools
→ allow get_result_page / search_result / get_context_lines
```

建议 `ToolResult` schema 预留：

```json
{
  "resultType": "inline | cached_reference",
  "resultId": "...",
  "sourceTool": "grep_files",
  "summary": "Found 248 matches in 32 files.",
  "truncated": true,
  "totalItems": 248,
  "totalSizeChars": 30520,
  "expiresAt": "..."
}
```

配套工具建议命名为：

- `get_result_page`
- `search_result`
- `get_context_lines`

而不是直接复用 `get_cached_result`，因为 result cache 不一定只缓存文本，也可能缓存结构化 items。

---

## 14. API Client 与本地服务契约

`modules/api_client.js` 封装了所有浏览器端到本地服务的调用，主要接口包括：

| 方法 | 对应服务端能力 | 参考价值 |
|---|---|---|
| `checkHealth()` | `/health` | 连接状态检测 |
| `getServices()` | `/tools` | 第一层服务发现 |
| `getToolsByServer(serverName)` | `/tools?serverName=...` | 第二层工具发现 |
| `executeTool(toolName, args)` | `/execute` | 工具执行 |
| `getConfig()` | `/config` | 配置读取 |
| `updateConfig(newConfig)` | `/config` | 配置更新 |
| `getCachedResult()` | `/result/{cache_id}` | 缓存分页读取 |
| `searchCachedResult()` | `/search-cache` | 缓存搜索 |
| `getCacheContext()` | `/get-cache-context` | 缓存上下文读取 |

`fetchWithTimeout()` 做了统一超时和错误处理。工具执行超时设为 120 秒，缓存读取/搜索为 30 秒，健康检查为 2 秒。

本项目 gateway client 应参考这一点：

1. 所有本地服务调用集中封装，不散落在 UI 代码中。
2. 不同操作设置不同超时。
3. 错误对象要保留 status/details，便于 diagnostics 展示。
4. health endpoint 不能只返回 `ok`，需要返回 workspace、tools、policy、external servers、last error 等诊断信息。

---

## 15. 安全模型分析

### 15.1 已有安全点

`mcp-bridge` 在浏览器端体现出的安全点包括：

- 服务启用/禁用。
- 全局 MCP 开关。
- 本地端口配置。
- 服务删除前 `confirm`。
- 配置保存通过本地服务处理。
- 工具执行异常有错误反馈。
- 大结果缓存避免无节制回填。
- 状态面板详情内容做 HTML escape。

从开发文档和用户手册看，它更强调“可用性”和“配置灵活性”。

### 15.2 主要风险

从本项目的安全优先定位看，它存在以下风险或不足：

1. **host permissions 较广**：manifest 中直接列出多个 AI 站点。
2. **工具执行偏直接**：模型输出工具调用后可以自动执行，缺少细粒度 per-tool permission policy。
3. **服务配置可能引入强能力**：filesystem、github、sqlite 等 MCP server 一旦启用，风险取决于外部 server。
4. **缺少统一审计日志**：状态面板展示当前状态，但不是完整可查询审计链路。
5. **没有 proposal 写入模型**：文件写入类能力若通过外部 MCP server 暴露，容易变成直接写入。
6. **配置编辑器需要更强校验**：Options Page 支持灵活 JSON 合并，但 schema、secret redaction、risk classification 需要加强。
7. **自动执行策略不够细**：更像全局开关，而不是按工具、按风险、按 server 控制。
8. **page world 可读取 adapter 配置**：非敏感配置问题不大，但未来不可把 token、policy secret 放进去。

### 15.3 本项目应如何吸收

本项目不应照搬“工具自动执行优先”的策略，而应采用：

```text
modelVisibility
uiVisibility
enabled
risk
executionPolicy
confirmationRequired
```

并把所有外部 MCP tool 默认设为：

```json
{
  "modelVisibility": "hidden",
  "enabled": false,
  "executionPolicy": "ask_every_time",
  "confirmationRequired": true
}
```

内置低风险只读工具可以 auto，高风险工具必须 ask every time。

---

## 16. 与本项目的对照

### 16.1 mcp-bridge 强于本项目的地方

| 方向 | mcp-bridge 现状 | 本项目现状/启发 |
|---|---|---|
| Chrome Extension 形态 | 已有 MV3 完整结构 | 后续 v0.7 需要迁移 |
| 多平台 adapter | 已有 `api_list.json` | 可抽象 ChatGPT adapter，但不急于多平台 |
| Options Page | 已有站点/服务/配置管理 | 需要补齐工具策略、审计、诊断 |
| Popup | 已有全局控制和 health check | 可参考轻量入口 |
| 状态面板 | 已有常驻浮窗、重扫、手动输入 | 可升级为 card-based panel |
| 大结果缓存 | 已有 cache/search/context/page | 本项目必须规划 result cache |
| 输入注入 | 兼容 contenteditable / React / Vue | ChatGPT result insertion 可直接借鉴思路 |
| 故障排除文档 | 较完整 | 本项目应补 `docs/troubleshooting.md` |
| 文档结构 | README + 架构 + fallback + cache + user guide | 本项目可形成同等文档骨架 |

### 16.2 本项目应保持差异化的地方

| 方向 | 不建议照搬 | 本项目更合适路线 |
|---|---|---|
| 多平台目标 | 早期支持过多平台 | ChatGPT Web 深度优先 |
| 工具执行 | 模型输出后偏自动执行 | 权限策略 + 确认 + 审计 |
| 文件写入 | 取决于外部 MCP server | proposal + confirm |
| Shell / 命令 | 外部 server 或 execute 类能力 | run_task 白名单 |
| UI 复杂度 | 浮窗为主 | Side Panel + Tool Cards |
| 配置灵活性 | 直接 JSON 合并 | schema 校验 + secret redaction + risk classification |
| 日志 | 状态提示为主 | 完整 audit log |
| Prompt 协议 | XML `<tool_code>` | fenced `mcp` JSON block |

---

## 17. 可直接转化为本项目需求的清单

### 17.1 v0.2 可吸收

1. Panel-side status card。
2. Redetect last assistant message。
3. Manual paste tool call。
4. Copy diagnostics。
5. Tool execution status：pending / executing / success / error。
6. Error details 可折叠展示。
7. Input injection 分层 fallback。
8. `resultInjected` 去重状态。
9. Extension context invalid 时提示刷新页面。
10. 请求注入失败时返回原始 body。

### 17.2 v0.3 可吸收

1. 外部 MCP server/service 管理。
2. server enabled / disabled。
3. tool namespace。
4. stdio MCP adapter。
5. 外部工具 tools/list 和 tools/call。
6. 外部 server status。
7. secret redaction。
8. server lifecycle：start / stop / restart / reload。

### 17.3 v0.4 可吸收但需改造

1. 写入链路不能直接 execute。
2. 需要 `write_file_proposal`。
3. Options 中展示 proposal。
4. apply 前 hash 校验。
5. apply 进入 audit log。
6. 高风险工具永远 ask every time。

### 17.4 v0.7 Chrome Extension 迁移可吸收

1. MV3 manifest 分层。
2. Page World fetch/XHR hook。
3. Content Script DOM/UI/input。
4. Background permission + tool execution。
5. Popup for quick controls。
6. Options for durable settings。
7. Shadow DOM panel。
8. web accessible resources 管理。

### 17.5 v0.8 result cache 可吸收

1. 大结果返回 cache reference。
2. search result。
3. get context lines。
4. get result page。
5. TTL 和内存/文件分层。
6. 模型提示中明确下一步工具。

---

## 18. 建议沉淀到本项目 PRD 的新增条目

### 18.1 Site Adapter Schema

即使只支持 ChatGPT，也建议定义：

```json
{
  "name": "chatgpt",
  "hostname": "chatgpt.com",
  "api": [],
  "promptInjection": {
    "strategy": "request_layer",
    "paths": []
  },
  "responseParsing": {
    "type": "sse",
    "contentPaths": [],
    "filterRules": null
  },
  "uiParsing": {
    "enabled": true,
    "priority": "api_then_ui",
    "messageContainer": [],
    "contentSelector": []
  },
  "input": {
    "selector": "#prompt-textarea",
    "submitStrategy": "button_then_enter",
    "submitDelayMs": 1600
  }
}
```

### 18.2 Fallback State Machine

建议写入 PRD：

```text
request_hook_active
→ catalog_injected
→ stream_observed
→ tool_call_detected_from_stream
→ tool_call_detected_from_complete_response
→ tool_call_detected_from_dom
→ redetect_requested
→ manual_paste_received
→ normalized_batch_created
→ permission_checked
→ execution_pending
→ executing
→ result_ready
→ result_inserted
→ result_sent
→ completed / failed
```

### 18.3 Diagnostics Package

借鉴它的用户手册和状态面板，本项目应定义诊断包：

```json
{
  "gateway": {
    "connected": true,
    "baseUrl": "http://127.0.0.1:8024",
    "workspaceRoot": "..."
  },
  "adapter": {
    "name": "chatgpt",
    "requestHookActive": true,
    "lastInjectionOk": true,
    "lastDetectionSource": "stream|complete|dom|redetect|manual"
  },
  "tools": {
    "total": 8,
    "enabled": 6,
    "hiddenFromModel": 2
  },
  "lastExecution": {
    "tool": "read_file",
    "ok": true,
    "durationMs": 9
  }
}
```

### 18.4 Result Cache Contract

建议写入 PRD：

```json
{
  "resultType": "cached_reference",
  "resultId": "...",
  "sourceTool": "grep_files",
  "summary": "Found 248 matches in 32 files.",
  "totalItems": 248,
  "totalSizeChars": 30520,
  "expiresAt": "..."
}
```

并配套工具：

- `get_result_page`
- `search_result`
- `get_context_lines`

### 18.5 Tool Policy Contract

建议 PRD 中新增工具策略结构：

```json
{
  "toolName": "external.filesystem.write_file",
  "serverName": "filesystem",
  "risk": "high",
  "enabled": false,
  "modelVisibility": "hidden",
  "executionPolicy": "ask_every_time",
  "confirmationRequired": true,
  "audit": true
}
```

---

## 19. 需要避免的误用

### 19.1 不要过早追求多平台

`mcp-bridge` 的强项是多平台适配，但本项目的优势是 ChatGPT Web 深度工作流。早期照搬多平台会稀释产品主线。

更合适的是：

```text
内部 adapter 化
外部只承诺 ChatGPT Web
```

### 19.2 不要直接开放强工具自动执行

`mcp-bridge` 偏向工具可用性，本项目定位是安全优先开发工作流。因此不能因为竞品能执行，就开放任意写入或命令执行。

必须坚持：

```text
read auto
write proposal
task whitelist
external ask every time
```

### 19.3 不要把状态面板当审计日志

状态面板是当前状态，不等于审计。审计日志必须持久化、可查询、可导出。

### 19.4 不要让配置灵活性压过 schema 安全

配置合并很好用，但本项目必须加：

- zod schema 校验。
- secret redaction。
- dangerous command pattern check。
- server/tool risk classification。
- 默认 disabled。

### 19.5 不要把敏感信息传入 page world

page world 与网页同域脚本共享环境。adapter 配置可以传，token、secret、工具权限决策和审计信息不能传。

---

## 20. 对本项目路线的具体建议

### 20.1 近期最值得做

1. 在 vNext PRD 中补充 `Site Adapter` 章节。
2. 为现有 userscript 增加 `Copy diagnostics`。
3. 增加 `Redetect last assistant message`。
4. 增加 `Manual paste mcp block`。
5. 把 result insertion 失败原因记录出来。
6. 将大结果处理从“截断文本”升级为“cache reference”设计。
7. 补 `docs/troubleshooting.md`。
8. 明确 `write_file` 自举能力的回收计划。

### 20.2 Chrome Extension 阶段优先级

迁移时不要一口气做所有 UI。建议顺序：

```text
1. MV3 shell + existing userscript logic port
2. Popup health / enable toggle
3. Side Panel diagnostics
4. Tool cards
5. Options tool policy
6. External MCP server config
7. Result cache UI
```

### 20.3 外部 MCP Adapter 阶段优先级

先做 stdio，不要先做远程 HTTP/SSE：

```text
stdio initialize
→ tools/list
→ tools/call
→ namespace
→ permission policy
→ audit log
→ server lifecycle
→ options UI
```

### 20.4 测试优先补齐

建议为本项目增加以下测试矩阵：

| 测试方向 | 重点用例 |
|---|---|
| request injection | 原始 body 保留、路径不存在、JSON string 字段、多路径注入 |
| stream parser | fenced mcp block 被 chunk 拆分、重复 chunk、多个工具调用 |
| DOM fallback | selector 失效、多个 assistant message、空 contentSelector |
| manual paste | 合法 batch、非法 JSON、未知工具、重复提交 |
| input injection | contenteditable、textarea、send button missing、Enter fallback |
| permission policy | read auto、write blocked、external ask_every_time |
| result cache | 超阈值缓存、搜索、分页、过期、cache missing |
| diagnostics | gateway disconnected、adapter mismatch、injection failed |

---

## 21. 结论

`mcp-bridge` 对本项目最重要的价值，不是“它支持很多平台”，而是它展示了一个浏览器扩展形态的 MCP 桥应该具备的产品骨架：

```text
站点适配配置
+ 请求/响应 hook
+ 多层 fallback
+ 状态面板
+ 输入注入
+ 本地服务 API client
+ 设置页
+ 缓存读取
+ 用户手册与排障路径
```

本项目要做得更好，需要在这些骨架上加入自己的差异化：

1. 更深的 ChatGPT Web 适配。
2. 更强的安全默认值。
3. 更细的工具权限模型。
4. 更严格的写入 proposal 流程。
5. 更完整的 audit log。
6. 更面向本地开发仓库的工作流闭环。
7. 更清晰的 result cache 与 diagnostics contract。

因此，`mcp-bridge` 应作为本项目 Chrome Extension 化、adapter schema、fallback diagnostics、result cache 和 Options Page 的主要参考，而不是作为多平台目标的直接模板。
