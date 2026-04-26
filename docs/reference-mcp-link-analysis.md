# mcp-link 参考仓库分析与解构

## 0. 文档信息

- 参考仓库：`tmp/reference/mcp-link`
- 分析对象：仓库 README、扩展 README、manifest、配置文件、SSE client、native messaging、communication、security/json loader 等可读取文件
- 输出文件：`docs/reference-mcp-link-analysis.md`
- 目标用途：为本项目的 PRD、Chrome Extension 形态、安全模型、权限策略、工具生态和产品化路线提供参考
- 分析日期：2026-04-26

> 注意：该仓库明确采用“visible source / proprietary source”模式，源码可阅读但不允许复制、fork 或复用。本文只做产品与架构层面的分析，不建议直接搬运任何代码实现。

---

## 1. 总体判断

`mcp-link` 和前面两个参考仓库的定位明显不同。

它不是一个单纯的 ChatGPT Web MCP bridge，也不是只面向本地开发者的 demo，而是试图做一个“AI 工具生态平台”：

```text
浏览器扩展
+ MCP SSE server
+ 远程工具
+ 本地工具
+ Native Messaging 自动发现
+ 配置/签名/安全声明
+ 工具商店/授权/付费预留
+ 浏览器自动化工具
+ 移动端/IoT 远期生态叙事
```

对本项目最有参考价值的不是它的代码实现，而是以下几类产品设计：

1. **工具权限模型**：Tool Visibility + Tool Approval，强调“AI 只能看到用户启用的工具”。
2. **运行时审批策略**：Ask every time / Allow automatically / Always allow，也包括高风险的 YOLO Mode 提醒。
3. **透明审计体验**：工具调用时展示 request、response、timestamp 等细节。
4. **SSE MCP 连接模型**：浏览器扩展直接连接 SSE MCP server，而不是只依赖本地 REST bridge。
5. **Native Messaging 自动发现**：通过本地 shim 自动发现本机 MCP server。
6. **配置驱动 UI**：`settings.json` 中不仅存默认值，也定义 UI 表单项、搜索关键词、确认文案、危险操作双重确认。
7. **站点 recipe 思路**：为 ChatGPT / Claude 分别配置输入框、提交按钮、登录状态、对话消息、附件上传等检测规则。
8. **安全品牌叙事**：把安全、可审计、沙箱、用户控制作为核心卖点，而不是附属功能。

但它也暴露出一些本项目需要谨慎避开的点：

- 权限非常宽：`<all_urls>`、`nativeMessaging`、`debugger`、`history`、`cookies`、`downloads`、`bookmarks`、`clipboardRead/Write` 等几乎全开。
- 源码高度混淆/压缩，维护和审计体验不友好。
- 远程配置/CDN/签名机制叙事很重，但实际安全校验代码里存在明显 placeholder/简化痕迹。
- 生态叙事过宽，容易偏离单一高质量产品闭环。
- proprietary visible source 对本项目没有代码复用价值。

因此，`mcp-link` 应作为“产品级安全/权限/生态设计”的参考，而不是作为实现模板。

---

## 2. 仓库结构解构

从目录看，`mcp-link` 不是单一扩展项目，而是一个多端生态仓库。

```text
tmp/reference/mcp-link/
├── README.md
├── extension/
│   ├── manifest.json
│   ├── README.md
│   ├── background.js
│   ├── content.js
│   ├── page.js
│   ├── config/
│   │   ├── settings.json
│   │   └── mcp_servers.json
│   ├── scripts/
│   │   ├── ai_connector.js
│   │   ├── browser.js
│   │   ├── communication.js
│   │   ├── json_loader.js
│   │   ├── mcp_sse_client.js
│   │   ├── nativemessaging.js
│   │   ├── security.js
│   │   └── ui.js
│   └── pages/
│       ├── popover.html/css/js
│       ├── terms.html/css/js
│       └── legal docs
├── server/
│   ├── mcp_server/
│   └── tools/
│       ├── ai_chat/
│       ├── cards/
│       ├── direct_sqlite/
│       └── whatsapp/
├── store/
│   └── pending/
└── legal / policy docs
```

几个明显特征：

| 方向 | 观察 | 对本项目的意义 |
|---|---|---|
| 仓库定位 | 生态型，而非单工具型 | 本项目不应过早扩张到全生态 |
| 扩展形态 | MV3 + content/page/background + popup/options | Chrome Extension 阶段可参考分层 |
| 工具协议 | 主推 SSE MCP server | 本项目后续外部 MCP adapter 可支持 SSE，但 P0 不急 |
| 权限范围 | 几乎全权限 | 本项目应坚持最小权限 |
| 配置方式 | JSON with comments + signature fields | 可借鉴 schema-driven config，但不要照搬签名设计 |
| UI | popup / popover / terms / policy pages | 可借鉴首次启用和高风险确认体验 |
| 法务 | EULA、Privacy、Royalty、Store | 对商业化/插件商店阶段有参考 |

---

## 3. 产品定位分析

### 3.1 不是“只给 ChatGPT 增强工具”

README 中明确写到支持 ChatGPT、Claude、Gemini、Perplexity、Grok 等 AI 网站，并且支持远程工具、本地工具、浏览器工具、移动端和 IoT 等方向。

这说明它的产品定位更像：

```text
AI 网站通用工具层 / Agent action gateway / Real-world action platform
```

而本项目当前更适合定位为：

```text
ChatGPT Web 本地开发工作流桥接器
```

这两者差别很大。

对本项目而言，可以吸收它的“用户控制和权限”思想，但不能吸收它的“全平台、全工具、全权限”路线。

### 3.2 安全是它的核心卖点

README 反复强调：

- Agents can only see tools you’ve approved。
- AIs cannot call any tool unless you’ve explicitly enabled it。
- Every call can prompt for user approval。
- Supports sandboxing via Docker。
- Logs every tool request, response, and agent call。

这点非常值得本项目学习。

本项目的竞争力不应只是“能让 ChatGPT 调本地工具”，而应是：

```text
在 ChatGPT Web 中安全、可控、可审计地调用本地开发工具
```

这个表述比“让网页 AI 调工具”更清晰，也更适合开发者场景。

---

## 4. Manifest 与扩展权限分析

### 4.1 Manifest V3 结构

`extension/manifest.json` 使用 MV3，核心包括：

- `background.service_worker`: `background.js`
- `content_scripts`: `content.js` 和 `page.js`
- `page.js` 运行在 `world: MAIN`
- `action.default_popup`: toolbar 页面
- `options_ui`: terms 页面
- `web_accessible_resources`: scripts、icons、popover、legal pages 等
- `externally_connectable`: 允许若干外部域名连接

这说明它采用典型的三层扩展结构：

```text
Page World
  ↓
Content Script
  ↓
Background Service Worker
  ↓
SSE MCP / Native Messaging / Storage / Browser APIs
```

与 `mcp-bridge` 类似，这个结构值得本项目 Chrome Extension 阶段采纳。

### 4.2 权限非常宽

manifest 权限包括：

```text
scripting
userScripts
idle
offscreen
alarms
declarativeNetRequest
activeTab
debugger
storage
history
cookies
bookmarks
notifications
tabs
windows
downloads
downloads.shelf
contextMenus
clipboardRead
clipboardWrite
unlimitedStorage
sidePanel
nativeMessaging
```

host permissions 是：

```text
<all_urls>
```

这对一个浏览器扩展来说是极高权限组合。

本项目不应照搬。更合理的策略是：

```text
P0 userscript / local bridge：只在 ChatGPT 页面运行
Chrome Extension P0：host_permissions 只给 chatgpt.com + localhost/127.0.0.1 gateway
P1：按功能申请 optional_permissions
P2：外部 MCP server 单独授权
```

### 4.3 权限申请要和功能绑定

`mcp-link` 的权限看起来是为“浏览器作为工具”预留的，例如读取历史、书签、下载、cookie、调试器、所有 URL。这个方向很强，但也风险巨大。

本项目如果未来做“Browser Tool”，建议拆成独立能力包：

| 能力 | 权限 | 默认状态 |
|---|---|---|
| ChatGPT 工具桥接 | chatgpt.com + localhost | 默认启用 |
| 读取当前页面 | activeTab | 按需启用 |
| 浏览器自动化 | debugger / tabs / scripting | 默认关闭，高风险 |
| 下载管理 | downloads | 默认关闭 |
| Cookie / History / Bookmarks | cookies/history/bookmarks | 不建议早期做 |
| Native Messaging | nativeMessaging | 独立安装步骤，高风险提示 |

这样比一次性申请全权限更符合用户信任。

---

## 5. 配置系统分析

### 5.1 `settings.json` 的特别之处

`extension/config/settings.json` 不是普通配置文件。它把默认值和 UI schema 放在一起。

结构大致是：

```json
{
  "MODULE_VERSION": "0.1.2",
  "signature": "...",
  "signdate": "...",
  "public_key": "...",
  "logging": {...},
  "ui": {...},
  "performance": {...},
  "settings": [
    {
      "yolo_mode": false,
      "ai_tool_access": true,
      "enable_browser_tool": true,
      "autoServerSettings": {...},
      "nativeConfig": {...},
      "mcpServers": {...}
    },
    {
      "id": "ai_tool_access",
      "type": "checkbox",
      "category": "security",
      "label": "AI tool access",
      "description": "...",
      "visibility": {...}
    },
    ...
  ],
  "SITE_CONFIGS": {...}
}
```

关键点：

1. `settings[0]` 是默认值存储区。
2. `settings[1...]` 是 UI 定义。
3. 每个配置项带 category、label、description、tooltip、visibility、search keywords。
4. 危险项支持 `confirmation_on_enable`。
5. reset 支持 double confirmation，需要输入 `RESET`。

这对本项目 Options Page 很有启发。

### 5.2 本项目可借鉴的 schema-driven settings

本项目可以设计一个更简单、更类型安全的设置 schema：

```json
{
  "id": "autoExecuteReadOnlyTools",
  "type": "boolean",
  "category": "security",
  "label": "Auto-execute read-only tools",
  "description": "Allow low-risk read-only tools to run without confirmation.",
  "defaultValue": true,
  "risk": "low",
  "requiresRestart": false
}
```

高风险配置应支持：

```json
{
  "confirmation": {
    "required": true,
    "level": "danger",
    "message": "This may allow AI to modify local files.",
    "requireTypedPhrase": "ENABLE"
  }
}
```

这比把 UI 写死在 Options 组件里更容易维护，也更适合后续开放 external MCP server。

### 5.3 JSON with comments

`json_loader.js` 支持 JSON 注释剥离。这对配置文件可读性有帮助，但也有两个问题：

1. 标准 JSON 工具链不完全兼容。
2. 如果要跨语言、跨工具、跨插件共享配置，JSONC 或 YAML 应该明确标注。

本项目建议：

```text
内部配置：JSON + zod schema
用户手写配置：JSONC 或 YAML，但必须明确格式并提供校验错误提示
导出/导入配置：标准 JSON，避免注释
```

---

## 6. Site Config / Recipe 设计分析

### 6.1 ChatGPT 和 Claude 的站点检测配置

`settings.json` 中的 `SITE_CONFIGS` 很值得看。它不是只配置 API 路径，而是配置了完整页面交互能力：

- 站点 URL pattern。
- chat input 检测。
- submit button 检测。
- login status 检测。
- conversation message 检测。
- form submission intercept。
- file input 检测。
- attachment methods。
- contenteditable 插入策略。
- 多语言 aria label。
- send / stop button 状态区分。

这比 `mcp-bridge` 的 `api_list.json` 更偏“浏览器操作 recipe”。

### 6.2 ChatGPT 配置中的可借鉴点

ChatGPT 配置包含：

```text
input:
- id: prompt-textarea
- fallback: div[contenteditable="true"]
- alternative: ProseMirror / composer-text-input / contenteditable#prompt-textarea

send button:
- id: composer-submit-button
- selector: button[data-testid="send-button"]
- fallback: button[type="submit"]
- ariaLabels: Send prompt / Send message / 多语言发送文案

conversation:
- userMessageSelector: [data-message-author-role="user"]
- aiMessageSelector: [data-message-author-role="assistant"]
- conversationContainer: main / role=main / conversation-turn

file input:
- 排除 upload-photos / upload-camera
- 支持 direct / dragdrop / clipboard
```

这些对本项目很有价值。尤其是：

1. 不要只依赖 `#prompt-textarea`。
2. send button 优先于 Enter。
3. 需要识别 send button 和 stop streaming button。
4. DOM message selector 应以 `data-message-author-role` 为首选。
5. 附件上传应单独建模，不要混在文本注入里。

### 6.3 本项目推荐的 Site Adapter 分层

建议本项目把站点适配拆成三层：

```text
Network Adapter
  - request hook
  - response parser
  - catalog injection

DOM Adapter
  - input detection
  - send button detection
  - assistant message detection
  - redetect last message

Interaction Adapter
  - insert text
  - submit
  - attach files
  - copy diagnostics
```

对应 schema 可以是：

```json
{
  "site": "chatgpt.com",
  "network": {...},
  "dom": {...},
  "interaction": {...},
  "diagnostics": {...}
}
```

这样能同时吸收 `mcp-bridge` 的 API adapter 和 `mcp-link` 的 UI recipe，而不是混成一个巨大配置。

---

## 7. 工具权限模型分析

### 7.1 Tool Visibility

`mcp-link` 明确强调：用户通过 checkbox 决定每个 tool 是否对 AI 可见。禁用的工具完全不会出现在 AI 的可用工具列表中。

这点非常重要。

本项目不应只做：

```text
工具存在，但执行前问用户
```

而应做：

```text
工具默认不可见
→ 用户启用后才向模型暴露
→ 暴露时仍可设置执行策略
```

原因是：如果模型知道有高风险工具，即使执行时拦截，也可能围绕该工具生成不稳定计划，增加误用概率。

### 7.2 Tool Approval

`mcp-link` 的运行策略大致是：

```text
Ask every time
Allow automatically
Always allow / YOLO Mode
```

本项目可以设计得更细一些：

| 策略 | 适用工具 | 默认值 |
|---|---|---|
| `auto` | 低风险只读，例如 list_directory、read_file、search_files | 可选默认启用 |
| `ask_every_time` | 外部 MCP 工具、网络请求、非白名单工具 | 默认 |
| `proposal_only` | 文件写入、代码修改 | 默认 |
| `disabled` | 高风险 shell、删除、凭据读取 | 默认 |
| `never_expose` | 不应让模型知道的工具 | 默认 |

尤其对写入类工具，建议坚持：

```text
AI 只能提出 proposal
用户确认后才 apply
apply 前做 hash 校验
apply 后写 audit log
```

### 7.3 YOLO Mode 的启发和边界

`settings.json` 中有 `yolo_mode`，并配有危险确认文案：启用后会自动批准所有工具调用，可能访问/修改文件、运行命令和网络请求。

本项目可以保留类似能力，但不应叫 YOLO Mode 作为正式产品文案。更合适的名字：

```text
Hands-free Mode
Trusted Automation Mode
Auto-approve trusted tools
```

并且需要硬性限制：

- 只能对已标记为 low-risk 的工具启用。
- 对 write / shell / external server 默认无效。
- 必须显示当前启用工具数量和风险等级。
- 必须可一键暂停。
- 必须有 audit log。

---

## 8. 透明审计体验分析

README 明确说，工具使用时会显示 dropdown summary，包括：

- tool name
- exact request
- raw response
- timestamp

这非常适合本项目的 tool card 设计。

本项目的 Side Panel / Tool Card 应至少包含：

```text
ToolCallCard
  - tool name
  - status: pending / waiting_approval / running / success / error / skipped
  - source: stream / complete_response / dom / manual
  - arguments preview
  - result summary
  - duration
  - timestamp
  - copy request
  - copy response
  - copy diagnostics
  - retry / approve / reject / insert result
```

对于敏感字段：

```text
- 默认脱敏展示
- 点击 reveal 需用户确认
- copy diagnostics 默认不包含 secret
```

这比只在浮窗里显示“执行成功/失败”更适合开发者调试。

---

## 9. SSE MCP Client 分析

### 9.1 连接模型

`mcp_sse_client.js` 实现了 fetch-based SSE client，核心行为包括：

1. 连接 `sseUrl`。
2. 读取 text/event-stream。
3. 解析 SSE line：`event`、`data`、`id`、`retry`。
4. 接收 `endpoint` event，得到 message endpoint 和 session_id。
5. 后续通过 POST 向 message endpoint 发送 JSON-RPC 请求。
6. SSE 流中接收响应。
7. 支持 reconnect、restart、disconnect。

这符合 MCP SSE transport 的基本模式：

```text
GET /sse
  ← event: endpoint, data: /message?session_id=...
POST /message?session_id=... JSON-RPC request
  ← SSE response event
```

### 9.2 对本项目的启发

本项目当前更适合本地 HTTP gateway / userscript 的简化路线，但后续支持外部 MCP server 时，可以规划两种 adapter：

```text
ExternalMcpAdapter
  - stdio transport
  - sse transport
  - http streamable transport（后续）
```

其中 Chrome Extension 端不一定直接连 SSE server。更安全的做法是：

```text
Chrome Extension
  → Local Gateway
    → External MCP stdio/SSE/HTTP
```

原因：

- 权限策略集中在 gateway。
- secret 不进入网页上下文。
- 审计和缓存可以统一处理。
- 浏览器扩展不需要知道太多外部 server 细节。

但如果未来做“无本地 gateway 的纯扩展模式”，SSE client 设计就有参考价值。

---

## 10. Native Messaging 自动发现分析

### 10.1 它做了什么

`nativemessaging.js` 通过 `chrome.runtime.connectNative("com.aurafriday.shim")` 连接本机 native host。

它的用途是：

- 自动发现本地 MCP server。
- 接收 native host 推送的配置。
- 保存 `baseUrl`、`sseUrl`、tools 等信息。
- 监听配置变化。
- 支持重连和 ping。

### 10.2 对本项目的价值

Native Messaging 对“安装体验”有价值：用户装好一个本地服务后，扩展可以自动发现，不需要手填端口。

但它也会显著增加：

- 安装复杂度。
- 跨平台维护成本。
- 安全审查压力。
- 浏览器商店审核难度。

本项目不宜在早期采用 Native Messaging。更合适路线：

```text
P0/P1：localhost HTTP gateway + health check + 手动端口
P2：固定端口 + 自动探测 127.0.0.1 常见端口
P3：Native Messaging shim 可选安装
```

如果做 Native Messaging，需要明确：

- native host 安装路径。
- host manifest 注册流程。
- 签名/版本校验。
- 最小权限。
- 一键卸载。
- 诊断页面。

---

## 11. 安全与签名机制分析

### 11.1 安全叙事很强

仓库包含：

- `.well-known/security.txt`
- `PRIVACY.md`
- `EULA.md`
- `LICENSE`
- `security.js`
- `json_loader.js`
- 配置文件中的 `signature`、`signdate`、`public_key`

从产品包装上看，它试图建立“配置可验证、工具可控、审计透明”的信任体系。

### 11.2 但实现上需要谨慎看待

可读取的 `security.js` 中存在明显 placeholder 行为，例如：

```text
sign(...) 返回 PLACEHOLDER-SIG
verify(...) 返回 true
verifyFile(...) 返回 true
```

这意味着当前仓库中的安全校验实现至少在可读版本里并不完整。

本项目吸收时要注意：

```text
安全功能不能只写在 README 或 UI 文案里
必须有真实实现、测试和失败处理
```

### 11.3 本项目建议的真实安全基线

本项目如果引入外部配置或工具市场，至少需要：

1. zod schema 校验。
2. 配置来源标记：builtin / local / imported / remote。
3. secret redaction。
4. tool risk classification。
5. per-tool execution policy。
6. audit log。
7. external server 默认 disabled。
8. 导入配置时展示 diff。
9. 对远程 manifest 做签名校验时，必须有真实 cryptographic verification 和测试。
10. 签名失败时 fail closed，而不是警告后继续。

早期如果不做完整签名，宁可明确：

```text
P0 不支持远程自动更新工具 manifest
```

不要做半成品安全机制。

---

## 12. Browser Tool 方向分析

`mcp-link` 不仅让 AI 网站调用工具，也让浏览器本身成为工具：

```text
read and interact with web pages
click elements
navigate pages
almost anything else you can do with your browser
```

这与本项目的主线不同，但有长期参考价值。

### 12.1 不建议早期做完整浏览器自动化

原因：

- 权限太高。
- 用户误操作风险高。
- ChatGPT Web 页面和目标网页之间的上下文隔离复杂。
- 审计、回滚、确认都很重。
- 与本项目“本地开发工作流”主线不完全一致。

### 12.2 可以保留受限能力

本项目可以先支持极窄的 browser diagnostics：

```text
- 获取当前 ChatGPT tab 的 adapter 状态
- 读取最后一条 assistant message
- 重新检测工具调用
- 插入工具结果
- 复制 diagnostics
```

不建议早期支持：

```text
- 任意网页点击
- 任意网页读取
- 浏览器历史/cookie/bookmark 操作
- debugger 自动控制
```

---

## 13. 与前两个参考仓库的对照

### 13.1 三个仓库的差异

| 维度 | DeepseekWeb-enhance | mcp-bridge | mcp-link |
|---|---|---|---|
| 形态 | userscript + FastAPI | Chrome Extension + local Flask bridge | Chrome Extension + SSE MCP + Native Messaging + ecosystem |
| 主目标 | DeepSeek Web 增强 / MCP 实验 | 多 AI 平台 MCP bridge | AI 工具生态平台 |
| 代码复用价值 | 高，尤其 userscript/gateway | 高，尤其扩展分层/fallback/cache | 低，源码 proprietary 且混淆 |
| 产品参考价值 | 中 | 高 | 高，主要在权限/审计/生态 |
| 安全默认 | 中等 | 中等 | 叙事强，但权限过宽 |
| 对本项目启发 | 快速原型、server API、危险命令拦截 | Chrome Extension 架构、fallback、status panel、cache | 权限模型、审批策略、透明审计、recipe、settings schema |

### 13.2 本项目应综合吸收的路线

```text
DeepseekWeb-enhance：学快速 userscript + local server 原型
mcp-bridge：学 MV3 分层 + fallback + panel + result cache
mcp-link：学权限模型 + per-tool approval + audit transparency + recipe schema
```

不要吸收：

```text
DeepseekWeb-enhance：不要长期停留在单 userscript 巨文件
mcp-bridge：不要默认自动执行所有外部工具
mcp-link：不要全权限、全生态、全平台、混淆代码、半成品签名
```

---

## 14. 可转化为本项目 PRD 的需求条目

### 14.1 Tool Visibility

新增需求：

```text
每个工具必须有 modelVisibility 字段：visible / hidden / neverExpose。
只有 visible 工具会出现在注入给模型的 catalog 中。
外部 MCP server 的工具默认 hidden。
```

推荐 schema：

```json
{
  "toolName": "read_file",
  "namespace": "builtin",
  "risk": "low",
  "modelVisibility": "visible",
  "enabled": true,
  "executionPolicy": "auto"
}
```

### 14.2 Runtime Approval Policy

新增需求：

```text
每个工具支持独立执行策略：auto / ask_every_time / proposal_only / disabled。
```

规则：

```text
read-only low risk：可 auto
external tools：默认 ask_every_time
write tools：默认 proposal_only
shell/system/browser control：默认 disabled
```

### 14.3 Tool Call Transparency

新增需求：

```text
所有工具调用生成 ToolCallCard，用户可查看 exact request、raw response、timestamp、duration、source、policy decision。
```

### 14.4 Dangerous Mode Confirmation

新增需求：

```text
任何会扩大自动执行范围的开关，都必须展示风险说明，并要求二次确认。
```

特别是：

- 自动执行外部工具。
- 自动发送工具结果。
- 启用写入 apply。
- 启用浏览器控制。

### 14.5 Site Recipe Schema

新增需求：

```text
站点适配不只包含 API path，还应包含 input、submit、message、login、attachment、diagnostics 等 DOM recipe。
```

### 14.6 Native Discovery 作为 P3

新增需求：

```text
Native Messaging 自动发现本地 MCP server 作为 P3 可选增强，不进入 P0/P1。
```

### 14.7 Remote Manifest 暂缓

新增需求：

```text
P0/P1 不支持远程工具 manifest 自动更新。若未来支持，必须引入真实签名校验、schema 校验和 fail-closed 策略。
```

---

## 15. 推荐写入本项目架构的策略

### 15.1 权限分层

```text
Tool Registry
  - known tools
  - source
  - risk
  - schema
  - default policy

Policy Engine
  - model visibility
  - execution policy
  - confirmation requirements
  - secret redaction

Execution Engine
  - builtin tools
  - external MCP tools
  - result cache
  - audit log

UI Layer
  - tool cards
  - approvals
  - settings
  - diagnostics
```

### 15.2 Tool Policy 决策流程

```text
模型输出 ToolCallBatch
→ parse / normalize
→ validate schema
→ find tool in registry
→ check enabled
→ check modelVisibility consistency
→ classify risk
→ apply executionPolicy
→ auto / ask / proposal / reject
→ execute or wait for user
→ record audit log
→ insert result if allowed
```

### 15.3 设置页优先级

借鉴 `settings.json` 的 schema-driven UI，本项目 Options Page 可按如下分区：

```text
Connection
  - Gateway URL
  - Health status
  - Workspace root

Security
  - Tool visibility defaults
  - Auto execute read-only tools
  - Auto insert result
  - Auto send result
  - Dangerous switches

Tools
  - Builtin tools
  - External MCP servers
  - Per-tool policy

Diagnostics
  - Copy diagnostics
  - Recent failures
  - Adapter status

Advanced
  - Site adapter config
  - Result cache settings
  - Import/export config
```

---

## 16. 风险与不建议采纳点

### 16.1 不建议采纳 `<all_urls>` 默认权限

本项目早期只需要 ChatGPT Web + localhost gateway。申请 `<all_urls>` 会显著降低用户信任。

### 16.2 不建议采纳 debugger / cookies / history / bookmarks 权限

这些权限属于浏览器级高风险能力，不符合当前开发工具桥接主线。

### 16.3 不建议采纳 proprietary visible source 模式

本项目如果开源，建议采用清晰开源许可证。若不开源，也应避免把“可见但不可复用”的代码作为社区协作基础。

### 16.4 不建议过早做 Store / payment / royalty

工具商店、付费、授权会显著增加复杂度。当前更重要的是把 ChatGPT Web + 本地开发工具闭环做稳。

### 16.5 不建议把签名机制做成装饰

如果配置签名没有真实校验和测试，反而会制造虚假安全感。早期应少做远程动态配置。

### 16.6 不建议把浏览器自动化作为默认能力

“浏览器作为工具”很强，但它应是独立高风险模块，而不是主桥接能力的一部分。

---

## 17. 对本项目路线的具体建议

### 17.1 v0.2 / v0.3 即可吸收

1. 工具可见性：`modelVisibility`。
2. 工具执行策略：`executionPolicy`。
3. ToolCallCard 展示 request / response / timestamp。
4. 高风险开关二次确认。
5. Copy diagnostics 默认脱敏。
6. ChatGPT DOM recipe 增加 send button、assistant message、input fallback。

### 17.2 v0.4 / v0.5 可吸收

1. External MCP server 默认 hidden + disabled。
2. Per-tool policy UI。
3. Audit log 查询。
4. Result cache 与 ToolCallCard 关联。
5. Import config 前展示 diff + schema validation。

### 17.3 v0.7 Chrome Extension 阶段可吸收

1. MV3 content/page/background 分层。
2. Side Panel / popup / options 分工。
3. Site recipe schema。
4. Optional permissions 按功能申请。
5. Browser tool 能力保持关闭或不实现。

### 17.4 v1.0 之后再考虑

1. SSE MCP direct transport。
2. Native Messaging 自动发现。
3. 远程 manifest。
4. 工具市场。
5. 沙箱/容器执行集成。
6. Browser automation tool。

---

## 18. 推荐新增 PRD 片段草案

### 18.1 Tool Visibility & Approval

```text
系统必须区分“工具存在”“工具启用”“工具对模型可见”“工具可自动执行”四个概念。

- 工具存在：工具已被 registry 识别。
- 工具启用：用户允许该工具被当前 workspace 使用。
- 工具对模型可见：该工具会出现在注入给 ChatGPT 的工具 catalog 中。
- 工具可自动执行：模型调用后无需用户确认即可执行。

外部 MCP 工具默认存在但不可见、不可执行。用户必须显式启用并选择执行策略。
```

### 18.2 High-risk Confirmation

```text
任何扩大自动执行范围、启用外部工具、启用写入能力、启用浏览器控制能力的设置，都必须展示风险说明。
高风险设置启用时至少需要一次确认；破坏性或跨权限设置需要输入确认短语。
```

### 18.3 Tool Audit Card

```text
每次工具调用必须生成可审计记录，包含：
- call id
- source message id
- detection source
- tool name
- normalized arguments
- policy decision
- execution status
- started / ended timestamp
- duration
- sanitized result summary
- raw request / raw response 的可复制入口
```

### 18.4 Site Recipe

```text
ChatGPT Web adapter 必须包含 DOM recipe：
- input selectors
- submit button selectors
- send/stop state detection
- assistant message selectors
- user message selectors
- fallback parse strategy
- result insertion strategy
- diagnostics extraction
```

---

## 19. 结论

`mcp-link` 对本项目最有价值的地方，是它把“AI 调工具”产品化成了一个更完整的安全控制系统：

```text
工具可见性
+ 用户审批
+ 高风险模式确认
+ 透明审计
+ 远程/本地工具统一
+ 站点 recipe
+ Native discovery
+ 安全与法务叙事
```

本项目应该吸收这些设计理念，但保持更克制的工程路线：

1. **只深做 ChatGPT Web**，不要过早多平台。
2. **只申请必要权限**，不要 `<all_urls>` 和浏览器全权限。
3. **只默认开放低风险只读工具**，外部工具默认隐藏。
4. **写入走 proposal，不直接 apply**。
5. **工具调用必须可审计、可复制、可诊断**。
6. **远程 manifest / Native Messaging / Browser Tool 都放到后期**。
7. **安全机制必须真实可验证，不做装饰性签名**。

综合前面三个参考仓库，当前本项目最优路线应是：

```text
短期：DeepseekWeb-enhance 式快速 userscript + local gateway
中期：mcp-bridge 式 MV3 分层 + fallback + panel + result cache
长期：mcp-link 式 tool visibility + approval + audit + recipe + optional external ecosystem
```

这样既能保持 MVP 的速度，也能避免未来在权限、安全和扩展性上返工。
