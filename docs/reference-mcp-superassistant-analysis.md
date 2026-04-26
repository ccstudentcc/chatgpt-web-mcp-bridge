# MCP-SuperAssistant 参考仓库分析与解构

## 0. 文档信息

- 参考仓库：`tmp/reference/MCP-SuperAssistant`
- 分析对象：README、package、manifest、background、mcpclient、transport plugins、content script、adapter plugin registry、render_prescript、json function parser、function block renderer 等可读取文件
- 输出文件：`docs/reference-mcp-superassistant-analysis.md`
- 目标用途：为本项目的 Chrome Extension 架构、MCP transport、站点 adapter、工具调用渲染、自动执行策略、状态管理和产品路线提供参考
- 分析日期：2026-04-26

---

## 1. 总体判断

`MCP-SuperAssistant` 比 `mcp-bridge` 和 `mcp-link` 更接近一个“开源、产品化、跨平台 AI Web MCP 扩展”。它的核心价值不在于某一个工具调用细节，而在于它把以下几件事放进了一个完整 Chrome Extension 工程里：

```text
MV3 Extension
+ Vite / React / pnpm workspace
+ MCP SDK transport abstraction
+ SSE / WebSocket / Streamable HTTP
+ 多 AI 站点 adapter
+ Tool call renderer
+ Auto Execute / Auto Submit
+ Sidebar UI
+ Zustand 状态管理
+ Remote Config
+ Analytics
+ 插件注册与懒加载
```

对本项目最有参考价值的部分有六类：

1. **工程形态**：pnpm workspace + Vite + MV3 + TypeScript，适合作为中期 Chrome Extension 化的工程参照。
2. **MCP Client 抽象**：把 SSE / WebSocket / Streamable HTTP 做成 transport plugin，而不是把某个协议写死。
3. **站点 Adapter 系统**：为 ChatGPT、Gemini、DeepSeek、Kimi、Qwen 等站点提供懒加载 adapter。
4. **Tool Call 渲染器**：支持 JSONL function call 与 XML/ANTML 两类格式，处理 streaming、partial JSON、多行 JSON、CodeMirror/Monaco 等复杂情况。
5. **自动化策略**：提供 Auto Execute / Auto Submit / Auto Insert 之类能力，但也暴露了需要本项目更谨慎设计的风险边界。
6. **状态与事件系统**：content script 侧采用 event bus + Zustand stores + plugin registry，结构比单 userscript 更利于长期维护。

但它也有一些不适合直接照搬的点：

- 平台覆盖很广，容易导致 adapter 维护成本爆炸。
- background 中包含 analytics、remote config、demographic collection 等产品增长模块，对本项目 MVP 是噪声。
- 自动执行逻辑较激进，默认产品体验上需要更强的权限边界和审计约束。
- 代码规模较大，早期照搬会拖慢本项目主线。
- 某些 README 与代码实现存在轻微不一致，例如 README 强调多平台和功能，实际每个平台 adapter 的稳定性需要逐一验证。

因此，`MCP-SuperAssistant` 最适合作为本项目 **Chrome Extension 中期架构参考**，而不是 P0 原型模板。

---

## 2. 仓库结构解构

从目录看，该仓库是典型的 monorepo：

```text
tmp/reference/MCP-SuperAssistant/
├── README.md
├── package.json
├── chrome-extension/
│   ├── manifest.ts
│   ├── package.json
│   ├── vite.config.mts
│   ├── public/
│   │   ├── codemirror-accessor.js
│   │   ├── json_function_call_extractor.js
│   │   └── icons / covers
│   └── src/
│       ├── background/
│       │   ├── index.ts
│       │   ├── remote-config-manager.ts
│       │   └── firebase-remote-config-api.ts
│       └── mcpclient/
│           ├── core/
│           │   ├── McpClient.ts
│           │   ├── PluginRegistry.ts
│           │   └── EventEmitter.ts
│           ├── plugins/
│           │   ├── sse/SSEPlugin.ts
│           │   ├── websocket/WebSocketPlugin.ts
│           │   └── streamable-http/StreamableHttpPlugin.ts
│           └── types/
├── pages/content/
│   ├── src/index.ts
│   ├── src/plugins/
│   │   ├── plugin-registry.ts
│   │   ├── sidebar.plugin.ts
│   │   ├── remote-config.plugin.ts
│   │   └── adapters/
│   │       ├── chatgpt.adapter.ts
│   │       ├── gemini.adapter.ts
│   │       ├── deepseek.adapter.ts
│   │       ├── kimi.adapter.ts
│   │       ├── qwenchat.adapter.ts
│   │       └── ...
│   ├── src/stores/
│   ├── src/events/
│   ├── src/services/
│   └── src/render_prescript/
│       └── src/
│           ├── parser/
│           ├── renderer/
│           └── observer/
└── packages/
    ├── shared
    ├── storage
    ├── ui
    ├── env
    ├── vite-config
    ├── zipper
    └── ...
```

几个明显特征：

| 模块 | 观察 | 对本项目的意义 |
|---|---|---|
| monorepo | pnpm workspace + packages 分层 | 中期可借鉴，但 P0 不必这么重 |
| chrome-extension | MV3 service worker + content script | Chrome Extension 阶段值得参考 |
| mcpclient | MCP SDK + transport plugin | 外部 MCP server 支持时很有价值 |
| pages/content | 注入 UI、adapter、状态管理 | Side Panel / overlay / tool card 可参考 |
| render_prescript | 专门处理工具调用渲染 | 本项目最值得深入吸收的模块之一 |
| adapters | 多站点适配 | 本项目应只深做 ChatGPT，不早期多平台 |
| remote config / analytics | 产品运营模块 | 早期不建议引入 |

---

## 3. 产品定位分析

README 中的定位是：

```text
Brings MCP to ChatGPT, Perplexity, Grok, Gemini, Google AI Studio, OpenRouter, Kimi, GitHub Copilot, Mistral and more.
```

它不是某个单站点增强脚本，而是希望成为“AI Web 平台通用 MCP 工具层”。

这和本项目的合理定位有差异。本项目更适合先聚焦：

```text
ChatGPT Web 本地开发工具桥接器
```

或者更准确地说：

```text
在 ChatGPT Web 中安全、可控、可审计地调用本地 MCP / 文件 / 开发工具
```

`MCP-SuperAssistant` 的启发是：

- 未来可以跨站点。
- 未来可以支持多 MCP transport。
- 未来可以有工具调用卡片和自动执行模式。

但本项目早期不应被它的“多站点平台化”牵着走。对一个新项目来说，**单站点深做稳定性** 比 **十几个站点浅适配** 更重要。

---

## 4. 工程栈与构建方式

### 4.1 package 与 workspace

根目录 `package.json` 显示：

```text
pnpm@9.15.1
Node >= 22.12.0
React 19
Vite 6
TypeScript 5.8 rc
Turbo
ESLint / Prettier
```

`chrome-extension/package.json` 依赖包括：

```text
@modelcontextprotocol/sdk
zod
zustand
webextension-polyfill
vite-plugin-node-polyfills
```

这说明它是一个偏成熟的工程模板，而不是轻量 demo。

### 4.2 对本项目的建议

本项目中期 Chrome Extension 化时，可以采用类似但更克制的结构：

```text
apps/extension
apps/gateway
packages/shared
packages/protocol
packages/site-adapters
packages/tool-registry
```

建议保留：

- pnpm workspace
- TypeScript
- Vite
- zod
- Zustand（仅扩展 UI 层）
- shared types

不建议早期引入：

- Turbo，除非包数量变多
- Remote Config
- Analytics
- 多浏览器构建
- 过早抽象 plugin marketplace

---

## 5. Manifest 与权限分析

### 5.1 Manifest 特征

`chrome-extension/manifest.ts` 使用 MV3：

- `background.service_worker = background.js`
- `type = module`
- `content_scripts` 针对多个 AI 网站分别注入 `content/index.iife.js`
- `web_accessible_resources` 暴露 JS / CSS / SVG / icon
- `permissions = ['storage', 'clipboardWrite']`
- host_permissions 包含 ChatGPT、Perplexity、Gemini、Grok、DeepSeek、GitHub、Kimi、Qwen 等多个 AI 站点以及 Google Analytics

相比 `mcp-link` 的 `<all_urls>` 和大量高危权限，`MCP-SuperAssistant` 的权限克制得多。

### 5.2 对本项目的启发

本项目 Chrome Extension P0 推荐更窄：

```text
permissions:
  - storage
  - clipboardWrite（可选，若复制诊断需要）

host_permissions:
  - https://chatgpt.com/*
  - http://localhost:<gateway-port>/*
  - http://127.0.0.1:<gateway-port>/*
```

不建议早期包含：

```text
*://*.github.com/*
*://*.x.com/*
*://*.google-analytics.com/*
<all_urls>
debugger / cookies / history / downloads / nativeMessaging
```

本项目应把权限和功能绑定：

| 功能 | 权限 | 阶段 |
|---|---|---|
| ChatGPT 页面适配 | `https://chatgpt.com/*` | P0 |
| 本地 gateway | `localhost / 127.0.0.1` | P0 |
| 复制诊断 | `clipboardWrite` | P0/P1 |
| 外部 MCP SSE | optional host permissions | P2 |
| Native Messaging | `nativeMessaging` | P3 |
| 浏览器自动化 | scripting / debugger / tabs | 独立高风险模块 |

---

## 6. Background 架构分析

### 6.1 background 的职责

`chrome-extension/src/background/index.ts` 负责：

1. 初始化扩展。
2. 从 `chrome.storage.local` 读取 MCP server URL 和 connection type。
3. 默认支持：
   - SSE: `http://localhost:3006/sse`
   - WebSocket: `ws://localhost:3006/message`
   - Streamable HTTP: `http://localhost:3006`
4. 初始化 Remote Config。
5. 周期性检查 MCP server 连接状态。
6. 处理 content script 发来的 `mcp:*` 消息。
7. 调用工具、获取工具列表、强制重连、更新 server config。
8. 广播 connection status / tool updates / config updates 给所有 tabs。
9. 做 analytics tracking。

简化后的结构是：

```text
Content Script
  → chrome.runtime.sendMessage(mcp:...)
Background
  → McpClient
  → MCP server
Background
  → broadcast status/tools/config
Content Script
  → UI store / sidebar / renderer update
```

### 6.2 对本项目的启发

这套分层是合理的。建议本项目 Chrome Extension 阶段也采用：

```text
content script：负责 ChatGPT DOM、工具调用检测、结果插入、UI 展示
background：负责连接本地 gateway / MCP server、存储设置、统一执行工具
gateway：负责本地文件系统、shell、MCP stdio、权限校验
```

注意：本项目不建议让 content script 直接执行高风险工具。工具执行应该集中在 background 或 gateway，并且由 policy engine 统一决策。

### 6.3 周期性连接检查

该仓库每 1 分钟检查连接状态，并在断开时尝试恢复。这对用户体验有价值。

本项目可以吸收：

```text
- health check
- reconnect
- connection status broadcast
- tools refresh
```

但应避免：

```text
- 连接失败时过度重试刷日志
- 服务未启动时频繁弹错误
- 多 tab 同时触发重连
```

推荐本项目设计：

```text
GatewayConnectionManager
  - explicit connect
  - passive health check
  - exponential backoff
  - one active reconnect task
  - user-visible status: disconnected / connecting / connected / degraded
```

---

## 7. MCP Client 与 Transport Plugin

### 7.1 McpClient 核心设计

`McpClient.ts` 中的核心对象是：

```text
McpClient
  - PluginRegistry
  - activePlugin
  - activeTransport
  - MCP SDK Client
  - primitives cache
  - health monitoring
  - EventEmitter
```

连接流程：

```text
connect({ uri, type })
→ getInitializedPlugin(type)
→ plugin.connect(uri) returns Transport
→ new MCP Client(...)
→ client.connect(transport)
→ cache primitives
→ emit connection status
```

工具调用流程：

```text
callTool(toolName, args)
→ activePlugin.callTool(client, toolName, args)
→ emit tool:call-started / completed / failed
→ analytics tracking
→ health check after failure
```

### 7.2 Transport Plugin 类型

仓库支持三类 transport：

| Transport | 文件 | 默认 URL |
|---|---|---|
| SSE | `SSEPlugin.ts` | `http://localhost:3006/sse` |
| WebSocket | `WebSocketPlugin.ts` | `ws://localhost:3006/message` |
| Streamable HTTP | `StreamableHttpPlugin.ts` | `http://localhost:3006` |

这对本项目长期架构很有启发。不要把 MCP transport 写死成单一 HTTP endpoint。

### 7.3 本项目推荐抽象

本项目可以在中期设计：

```ts
interface ToolTransportAdapter {
  id: string;
  type: 'local-gateway' | 'mcp-sse' | 'mcp-streamable-http' | 'mcp-stdio' | 'mock';
  connect(config: TransportConfig): Promise<void>;
  listTools(): Promise<ToolManifest[]>;
  callTool(call: NormalizedToolCall): Promise<ToolResult>;
  health(): Promise<TransportHealth>;
  disconnect(): Promise<void>;
}
```

P0 只实现：

```text
local-gateway
```

P1/P2 再实现：

```text
mcp-sse
mcp-streamable-http
mcp-stdio via gateway
```

这样可保留扩展性，但不会拖慢 MVP。

### 7.4 primitives cache

`McpClient` 对 tools/resources/prompts 做 5 分钟 cache。

这对本项目有价值，但需要加失效条件：

```text
- server URL 变化
- workspace root 变化
- tool policy 变化
- external MCP server reconnect
- 用户手动 refresh tools
```

推荐 PRD 条目：

```text
Tool catalog 必须有 cacheVersion。任何连接配置、权限策略或外部工具源变化时，catalog cache 必须失效并重新注入。
```

---

## 8. Content Script 架构分析

### 8.1 content script 职责

`pages/content/src/index.ts` 做了很多事情：

- 初始化 logger。
- 发送 analytics。
- 设置 sidebar recovery。
- 初始化 renderer。
- 初始化 MCP client bridge。
- 初始化 application architecture。
- 初始化 services。
- 暴露 `window.mcpClient`、`window.pluginRegistry`、`window.mcpAdapter`。
- 监听 background 消息。
- 处理 sidebar toggle、function call rendering、remote config update、version update。
- beforeunload cleanup。

这说明它不是轻量 content script，而是完整前端应用入口。

### 8.2 对本项目的启发

本项目 Chrome Extension 阶段可以参考它的模块划分，但应更克制：

```text
content/index.ts
  - init site adapter
  - init tool call detector
  - init tool card UI
  - connect background bridge
  - handle lifecycle cleanup
```

不要早期把 analytics、remote config、复杂 sidebar recovery 全部引入。

### 8.3 window 暴露对象要谨慎

该仓库把多个对象挂到 `window` 上用于调试和兼容：

```text
window.mcpClient
window.pluginRegistry
window.mcpAdapter
window.CodeMirrorAccessor
window.JSONFunctionExtractor
```

这对调试有用，但也会扩大攻击面。对于本项目：

- 生产模式下不建议暴露执行对象。
- 如果暴露 debug object，应只读、不可调用高风险方法。
- Page world 与 isolated world 要分清。
- 不应把 secret 或 tool token 暴露到 page world。

推荐策略：

```text
development: expose debug helpers
production: expose only minimal diagnostics, no tool execution object
```

---

## 9. 站点 Adapter Plugin 系统

### 9.1 设计思路

`pages/content/src/plugins/plugin-registry.ts` 负责注册站点 adapter。它采用：

```text
PluginRegistry
  - eagerly register RemoteConfigPlugin / SidebarPlugin
  - lazily register site adapters by hostname
  - activate best matching adapter
  - keep sidebar plugin persistent
  - sync AdapterStore
```

内置 adapter 包括：

```text
ChatGPT
Gemini
DeepSeek
Grok
Perplexity
AI Studio
OpenRouter
T3 Chat
Mistral
Kimi
Z.ai
Qwen
GitHub Copilot
```

这说明它把“站点适配”视为插件，而不是硬编码 if/else。

### 9.2 懒加载 adapter 的价值

adapter 文件很大，例如 ChatGPT adapter 约 52KB，AI Studio adapter 约 71KB。懒加载可以降低初始成本。

本项目虽然 P0 只做 ChatGPT，但依然可以在设计上保留：

```text
SiteAdapterRegistry
  - register(chatgpt)
  - detect current site
  - activate one adapter
```

这样未来扩展到 Claude / Gemini 时不会重构。

### 9.3 本项目推荐 adapter 接口

```ts
interface SiteAdapter {
  id: string;
  match(url: URL): boolean;
  detectComposer(): Promise<ComposerHandle | null>;
  detectSubmitButton(): Promise<SubmitButtonHandle | null>;
  detectAssistantMessages(): AssistantMessageHandle[];
  getLastAssistantMessage(): AssistantMessageHandle | null;
  insertText(text: string): Promise<void>;
  submit(): Promise<void>;
  attachFiles?(files: File[]): Promise<void>;
  collectDiagnostics(): Promise<SiteDiagnostics>;
}
```

需要明确区分：

```text
DOM detection
DOM mutation
tool call extraction
result insertion
submission
```

不要把所有逻辑塞进一个 adapter 巨类。

### 9.4 不要过早多站点

`MCP-SuperAssistant` 的多站点 adapter 对用户很有吸引力，但维护成本非常高。AI 网站 DOM 经常变，多个站点同时适配会消耗大量精力。

本项目建议路线：

```text
P0：ChatGPT only
P1：ChatGPT adapter 稳定性、诊断、fallback
P2：Claude / Gemini 任选一个作为第二站点验证架构
P3：adapter marketplace / community adapters
```

---

## 10. Tool Call 格式与渲染器

这是 `MCP-SuperAssistant` 最值得本项目学习的部分。

### 10.1 支持的工具调用格式

README 中给出的格式是 JSONL：

```jsonl
{"type": "function_call_start", "name": "function_name", "call_id": 1}
{"type": "description", "text": "Short 1 line of what this function does"}
{"type": "parameter", "key": "parameter_1", "value": "value_1"}
{"type": "parameter", "key": "parameter_2", "value": "value_2"}
{"type": "function_call_end", "call_id": 1}
```

代码中还支持 XML / ANTML 风格：

```xml
<function_calls>
  <invoke name="tool_name" call_id="...">
    <parameter name="arg">...</parameter>
  </invoke>
</function_calls>
```

### 10.2 JSON parser 的复杂处理

`jsonFunctionParser.ts` 做了很多边界处理：

- 去除语言标签：`json`、`jsonl`、`typescript`、`copy code` 等。
- 从带有本地化 UI 文案的文本中提取 JSON。
- 支持单行多个 JSON object。
- 支持 pretty-printed 多行 JSON object。
- 支持 streaming partial JSON。
- 支持 parameter 值未闭合时的 regex fallback。
- 支持 CodeMirror/Monaco hidden pre 内容。
- 避免重复解析已经渲染的 `.function-block`。

这说明真实网页上的 tool call extraction 很复杂，不能只靠一个简单正则。

### 10.3 对本项目的启发

本项目应明确：

```text
Tool call parser 是核心模块，不是 UI 附属逻辑。
```

推荐分层：

```text
RawMessageExtractor
  - 从 ChatGPT DOM 提取最后 assistant message 原始文本 / markdown / code blocks

ToolCallParser
  - JSONL parser
  - fenced code parser
  - XML/ANTML parser（可选）
  - partial streaming parser

ToolCallNormalizer
  - 统一为 NormalizedToolCall
  - call id
  - tool name
  - args
  - source range
  - completeness
  - parse confidence

ToolCallRenderer
  - 展示 call card
  - pending / streaming / complete / error
```

### 10.4 推荐本项目 P0 支持格式

本项目 P0 不建议一开始支持太多格式。推荐：

```text
主格式：JSON fenced block 或 JSONL fenced block
兼容：XML/ANTML 可作为 P1
不建议：从任意自然语言里猜工具调用
```

P0 提示词中可以强制模型输出：

```json
{
  "tool_calls": [
    {
      "id": "call_...",
      "name": "read_file",
      "arguments": { "path": "README.md" }
    }
  ]
}
```

比 JSONL 更简单，便于校验。但如果想适配 MCP-SuperAssistant 风格，也可以支持 JSONL parser 作为兼容层。

---

## 11. CodeMirror / Monaco 处理

### 11.1 为什么需要 accessor

`codemirror-accessor.js` 用于从 CodeMirror / Monaco editor 中提取真实文本。原因是很多 AI 网站把代码块渲染成复杂编辑器结构，普通 `textContent` 可能不稳定。

它支持：

- 监听 `.cm-editor`
- 读取 `cmContent.cmView.view.viewState.state.doc.toString()`
- 创建隐藏 `<pre>` 存放干净内容
- 检测 function call pattern 后隐藏原编辑器
- 处理 Qwen 的 Monaco `.view-lines .view-line`
- 暴露 `window.CodeMirrorAccessor`

### 11.2 对本项目的意义

如果本项目只做 ChatGPT，短期不一定需要这么复杂。但如果 ChatGPT 或其他站点将代码块渲染成 ProseMirror/CodeMirror/Monaco，类似策略就很重要。

建议本项目 P0 先做：

```text
- assistant message text extraction
- markdown code block extraction
- DOM textContent fallback
```

P1 再做：

```text
- code block specific extractor
- ProseMirror / CodeMirror / Monaco adapter
- hidden pre fallback
```

### 11.3 CSP 与 page context

该仓库为了访问页面上下文，会通过 `chrome.runtime.getURL('codemirror-accessor.js')` 注入 script 标签，并处理 CSP 兼容问题。

本项目需要注意：

- isolated world 中无法访问 page JS object。
- page world 注入脚本不能暴露 secret。
- web_accessible_resources 会增加可访问面。
- CSP 严格站点可能阻止 inline script，应该用 src 注入。

---

## 12. Function Block Renderer 与 Tool Card

### 12.1 Renderer 做了什么

`functionBlock.ts` 将原始工具调用代码块渲染为可交互 UI：

- function name
- call id
- description
- parameters
- streaming spinner
- expand/collapse
- raw toggle
- execute button
- auto expand while streaming
- complete 后 auto collapse
- auto execution
- execution cache / duplicate prevention

这基本就是本项目所需的 `ToolCallCard` 雏形。

### 12.2 本项目应吸收的 UI 行为

建议本项目 ToolCallCard 至少包含：

```text
Header
  - tool name
  - risk badge
  - status badge
  - call id
  - source: ChatGPT message / manual / replay

Body
  - arguments preview
  - raw request toggle
  - result summary
  - raw response toggle

Actions
  - approve
  - reject
  - run
  - copy request
  - copy response
  - copy diagnostics
  - retry
```

如果 streaming：

```text
- 参数逐步更新
- call 未完整时不允许执行
- 完整后进入 waiting_approval / ready
```

### 12.3 duplicate prevention

该仓库用 `executionTracker`、`contentSignature`、`getPreviousExecution` 防止重复执行。

本项目必须有类似机制。尤其 ChatGPT 页面重新渲染、DOM mutation、多次扫描时，很容易重复触发同一个工具调用。

推荐规则：

```text
toolCallKey = hash(sourceMessageId + toolName + normalizedArgs)

同一个 toolCallKey：
- 不重复自动执行
- 用户可手动 retry，但 retry 必须生成 new attempt id
- audit log 保留每次 attempt
```

---

## 13. 自动执行策略分析

### 13.1 该仓库的 autoExecute

`functionBlock.ts` 中会读取：

```text
window.__mcpAutomationState.autoExecute
toggleState.autoExecute
```

如果自动执行开启，并且 function call complete，就会自动点击 execute button。

它也做了：

- 最大尝试次数 3 次。
- 延迟执行。
- 检查是否已执行。
- 找不到 block 时尝试找 replacement block。

### 13.2 本项目需要更强的安全边界

自动执行是高风险功能。即使它很方便，也必须和工具风险等级绑定。

本项目不应只用一个全局 `autoExecute`。推荐：

```text
executionPolicy per tool:
  - auto
  - ask_every_time
  - proposal_only
  - disabled
```

并结合：

```text
risk level:
  - low_readonly
  - medium_network
  - high_write
  - critical_shell
```

默认策略：

| 工具类型 | 默认策略 |
|---|---|
| list/read/search | auto 或 ask，可由用户选择 |
| write proposal | proposal_only |
| write apply | ask_every_time，默认 disabled |
| shell | disabled |
| external MCP | hidden + ask_every_time |
| browser automation | disabled |

这样比全局 Auto Execute 更安全。

### 13.3 推荐 PRD 条目

```text
系统不得仅通过全局 autoExecute 开关决定是否执行工具。每次工具调用必须经过 Policy Engine，根据工具来源、风险等级、用户策略、当前 workspace、参数内容和重复执行记录产生 policyDecision。
```

---

## 14. Sidebar / UI 架构

### 14.1 Sidebar plugin

该仓库有 `sidebar.plugin.ts`，并在 plugin registry 中优先注册，且不会因为站点 adapter 切换而 deactivate。这说明它把 Sidebar 视为跨站点常驻 UI。

本项目可借鉴：

```text
SidePanel / Overlay UI 独立于 SiteAdapter
SiteAdapter 只提供页面交互能力
Tool UI / Policy UI / Diagnostics UI 由 Extension UI 层负责
```

### 14.2 本项目建议 UI 分工

```text
Content overlay / inline card
  - 展示工具调用卡片
  - 执行/批准/拒绝
  - 插入结果

Side Panel
  - 工具列表
  - 连接状态
  - audit log
  - policy settings
  - diagnostics

Options Page
  - gateway config
  - per-tool policy
  - external MCP servers
  - import/export config
```

早期如果不做 Side Panel，也至少应有：

```text
floating status panel + inline tool cards
```

---

## 15. Remote Config 与 Analytics

### 15.1 观察

background 中初始化 RemoteConfigManager，并处理：

```text
remote-config:fetch
remote-config:get-feature-flag
remote-config:get-config
remote-config:get-status
remote-config:clear-cache
```

content script 也收集：

- browser
- OS
- language
- screen resolution
- device type
- page view
- URL change

这些是产品增长和远程配置能力。

### 15.2 本项目不建议早期引入

本项目更偏开发者工具。早期引入 analytics / remote config 会增加：

- 隐私解释成本
- Chrome Web Store 审核成本
- 用户信任成本
- 实现复杂度

建议：

```text
P0/P1：不做 remote config，不做 analytics
P2：只做本地匿名 diagnostics，可手动复制
P3：若做遥测，必须 opt-in，并明确隐私策略
```

---

## 16. 与 mcp-link 的差异

| 维度 | mcp-link | MCP-SuperAssistant | 对本项目建议 |
|---|---|---|---|
| 许可证/源码 | visible proprietary，混淆多 | MIT，TypeScript 源码清晰 | 更适合参考 SuperAssistant 工程 |
| 权限 | 极宽，含 `<all_urls>` 和高危权限 | 相对克制，按站点 host_permissions | 本项目更应进一步收窄 |
| MCP transport | 自写 SSE client + native discovery | MCP SDK + transport plugin | 优先参考 SuperAssistant transport 抽象 |
| 站点配置 | JSON recipe 配置驱动 | TypeScript adapter plugin | 两者结合：schema + adapter |
| 安全叙事 | 很强，但签名实现可疑 | 更偏产品功能与工程实现 | 本项目需补上真实 policy engine |
| Tool UI | 审计下拉/工具权限叙事 | 函数调用卡片和自动执行 | 两者都吸收 |
| Native Messaging | 核心卖点之一 | 不明显 | 本项目后期再做 |

---

## 17. 与 mcp-bridge / DeepseekWeb-enhance 的差异

| 维度 | DeepseekWeb-enhance | mcp-bridge | MCP-SuperAssistant |
|---|---|---|---|
| 形态 | userscript + local server | Chrome extension + local bridge | 完整 MV3 extension + MCP SDK |
| 目标 | 快速增强单站点 | 桥接 Web AI 与 MCP | 多平台 MCP 工具产品 |
| 工程复杂度 | 低 | 中 | 高 |
| 适合阶段 | P0 原型 | P1/P2 扩展过渡 | P2/P3 产品化 |
| 站点适配 | 主要单站 | 有多平台思路 | 大量 adapter |
| 工具调用渲染 | 简单 | 中等 | 最完整 |
| 自动执行 | 依实现 | 有 | 完整但需加安全边界 |

本项目最佳吸收顺序：

```text
P0：DeepseekWeb-enhance 的快速 userscript/gateway 思路
P1：mcp-bridge 的扩展分层、状态 panel、fallback/cache
P2：MCP-SuperAssistant 的 transport plugin、adapter registry、tool renderer
P3：mcp-link 的安全叙事、tool visibility、approval、Native discovery
```

---

## 18. 可转化为本项目 PRD 的需求条目

### 18.1 MCP Transport Abstraction

```text
系统必须抽象 ToolTransportAdapter，不得把工具执行绑定到单一 HTTP endpoint。
P0 实现 local-gateway transport；P1/P2 可增加 MCP SSE / Streamable HTTP；stdio MCP 通过 local gateway 代理。
```

### 18.2 Site Adapter Registry

```text
ChatGPT Web 页面适配必须通过 SiteAdapterRegistry 管理。
P0 只注册 chatgpt adapter，但接口需保留未来扩展其他 AI 站点的能力。
```

### 18.3 Tool Call Parser

```text
工具调用解析必须独立成模块，至少输出 NormalizedToolCall：
- callId
- toolName
- arguments
- sourceMessageId
- sourceRange
- isComplete
- parseConfidence
- rawText
```

### 18.4 Streaming-aware Tool Card

```text
当 assistant message 仍在生成时，ToolCallCard 可以显示 streaming 状态，但不得执行 incomplete call。
只有 parser 判断 isComplete=true 且 schema validation 通过后，才进入 policy decision。
```

### 18.5 Duplicate Execution Guard

```text
系统必须使用 toolCallKey 防止重复执行。
toolCallKey 至少由 sourceMessageId、toolName、normalizedArguments hash 组成。
同一 toolCallKey 不得自动执行多次；手动 retry 必须生成新的 attemptId。
```

### 18.6 Per-tool Policy Engine

```text
系统不得使用单一全局 autoExecute 决定执行行为。每个工具调用必须经过 Policy Engine，并产生 policyDecision：auto / ask / proposal / reject。
```

### 18.7 Side Panel / Tool Audit

```text
Side Panel 应展示连接状态、工具列表、最近工具调用、失败诊断和 per-tool policy。每个工具调用必须可查看 raw request、raw response、timestamp、duration 和 policy decision。
```

---

## 19. 推荐写入架构文档的模块划分

```text
packages/protocol
  - NormalizedToolCall
  - ToolResult
  - ToolManifest
  - ToolPolicy
  - AuditRecord

packages/site-adapters
  - SiteAdapter interface
  - ChatGPTAdapter
  - DOM recipe

packages/tool-parser
  - JSON parser
  - JSONL parser
  - XML/ANTML parser（P1）
  - streaming parser

packages/tool-registry
  - builtin tools
  - external tools
  - risk classification

packages/policy-engine
  - visibility
  - execution policy
  - approval requirements
  - duplicate guard

apps/extension
  - content script
  - background
  - side panel
  - options

apps/gateway
  - local file tools
  - external MCP stdio proxy
  - audit persistence
```

---

## 20. 推荐实施路线

### 20.1 近期可吸收

1. 建立 `NormalizedToolCall` 数据结构。
2. 建立独立 parser，不把解析逻辑写进 UI。
3. 加 `toolCallKey` 和 duplicate guard。
4. ToolCallCard 展示 call id、tool name、args、status。
5. ChatGPT adapter 拆出 input / submit / message detection。
6. 建立 gateway connection status 和 health check。

### 20.2 中期可吸收

1. MV3 extension 化。
2. background 负责 gateway/MCP 连接。
3. content 负责 DOM/ToolCard。
4. SiteAdapterRegistry。
5. TransportAdapter abstraction。
6. Side Panel 审计与工具列表。
7. Zustand 管理 UI 状态。

### 20.3 后期再吸收

1. 多站点 adapter。
2. SSE / Streamable HTTP direct MCP。
3. Remote config。
4. Analytics opt-in。
5. Adapter marketplace。
6. Native discovery。
7. Browser automation tool。

---

## 21. 不建议采纳点

### 21.1 不建议早期多平台

多平台支持能提高 README 吸引力，但会让项目长期处于 DOM 适配追赶状态。当前应先把 ChatGPT 做稳。

### 21.2 不建议早期引入 remote config / analytics

开发者工具最重要的是本地可信。早期应避免网络遥测和远程行为变更。

### 21.3 不建议复制全局 autoExecute

全局自动执行会掩盖不同工具风险差异。本项目应以 per-tool policy 为准。

### 21.4 不建议把 parser 和 renderer 绑死

`MCP-SuperAssistant` 的 render_prescript 很强，但本项目应保持：

```text
parser 可单测
renderer 可替换
policy 可审计
execution 可隔离
```

### 21.5 不建议把复杂 editor extraction 放进 P0

CodeMirror / Monaco extraction 很有价值，但 P0 可以先用 ChatGPT DOM message + markdown code block 提取，后续再增强。

---

## 22. 对本项目的综合结论

`MCP-SuperAssistant` 是目前几个参考仓库中最接近“完整 Chrome Extension 产品工程”的一个。它对本项目的核心启发是：

```text
不要只做一个本地 API 调用脚本；
应逐步演化为：
Site Adapter + Tool Parser + Policy Engine + Execution Engine + Tool Audit UI + Transport Adapter。
```

但本项目仍应保持更克制的路线：

1. **只深做 ChatGPT**，不要早期多站点。
2. **先 local gateway**，不要一开始支持所有 MCP transport。
3. **parser 独立可测**，不要把工具调用识别散落在 UI 中。
4. **自动执行必须 per-tool policy**，不要全局开关一把梭。
5. **ToolCallCard 必须可审计**，显示 request、response、duration、policy decision。
6. **Chrome Extension 化时参考它的 MV3 + Vite + TS 架构**。
7. **后期再吸收 transport plugin、adapter registry、Side Panel 和多站点能力**。

综合四个参考仓库，本项目可以形成一条更稳的路线：

```text
P0：userscript + local gateway，验证 ChatGPT Web 工具闭环
P1：独立 parser / policy / audit / duplicate guard，强化安全与稳定性
P2：MV3 extension，content/background/side panel 分层
P3：MCP transport plugin + external tools + optional 多站点 adapter
P4：Native discovery / remote manifest / tool ecosystem
```

其中，`MCP-SuperAssistant` 主要服务于 P2/P3，尤其是：

```text
MV3 工程结构
MCP transport abstraction
站点 adapter registry
streaming-aware tool call renderer
自动执行 duplicate guard
Side Panel 与状态同步
```

这些可以写入本项目 PRD 和架构设计，但实现顺序应严格后移，避免 MVP 过重。
