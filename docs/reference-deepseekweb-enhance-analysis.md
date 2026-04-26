# DeepseekWeb-enhance 参考仓库分析与解构

## 0. 文档信息

- 参考仓库：`tmp/reference/DeepseekWeb-enhance`
- 分析对象：DS Enhance / DS MCP Bridge
- 目标用途：为 ChatGPT Web Local Agent Bridge 后续 PRD、架构设计、功能拆分和竞品对标提供参考
- 当前分析依据：
  - `README.md`
  - `CHANGELOG.md`
  - `CONTRIBUTING.md`
  - `shared/shared-header.js`
  - `server/server.py`
  - `server/tools/shell.py`
  - `server/tools/mcp_external.py`
  - `server/presets.json`
  - `server/tests/test_server.py`
  - `server/tests/test_management.py`
  - `server/tests/test_mcp_external.py`
  - `server/tests/test_presets.py`
- 读取限制：
  - `ds-enhance.user.js` / `ds-mcp-bridge.user.js` 两个完整 userscript 文件较大，且本地读取时曾触发敏感内容保护，因此本文主要基于 README、CHANGELOG、共享 UI 基础设施、服务端、工具层和测试文件进行解构。
  - `server/tests/test_tools.py` 本轮读取时触发 `SENSITIVE_CONTENT_BLOCKED`，未能纳入完整审查。
  - 与前端脚本强相关的判断，均应视为基于 README / CHANGELOG / 可读服务端源码的间接判断；后续如需继续深入前端脚本实现，建议按关键词分段读取或用 grep 定位局部片段。

---

## 1. 项目定位

`DeepseekWeb-enhance` 实际包含两个相对独立、但共享基础设施的浏览器增强脚本：

| 子模块 | 面向对象 | 核心定位 |
|---|---|---|
| `ds-enhance` | DeepSeek Chat | 会话管理增强工具 |
| `ds-mcp-bridge` | DeepSeek Chat + 本地 MCP server | 让 DeepSeek 调用本地工具和外部 MCP 工具 |

这个仓库的关键价值不在于“代码规模大”，而在于它验证了一个很重要的产品组合方向：

> 会话管理增强 + 本地工具调用，可以共享浏览器端基础设施，但在产品上应保持模块边界。

对本项目的启发是：ChatGPT Web Local Agent Bridge 不应只做 MCP 工具桥，也可以在长期路线中逐步补齐部分“网页 AI 工作台增强”能力，例如当前会话导出、tool history、本地标签、snapshot、本地索引等。

但需要特别注意，DS Enhance 的会话管理能力依赖 DeepSeek 内部 API 和 `localStorage.userToken`。这类能力不应被直接照搬到 ChatGPT Web 上。当前项目更适合优先做本地侧、可见 DOM 侧、用户显式授权侧的能力，避免早期进入读取平台内部 token/API、批量删除官方会话、Fork 官方会话等高风险路线。

---

## 2. 功能拆解

### 2.1 DS Enhance：会话管理增强

README 和 CHANGELOG 显示，`ds-enhance` 的主要能力包括：

| 功能 | 说明 | 产品价值 | 对本项目的借鉴等级 |
|---|---|---|---|
| 批量删除 | 勾选多个对话删除，支持清空全部 | 补齐官方界面批量操作缺口 | 不建议早期照搬 |
| Fork 对话 | 完整复制对话，或从指定节点分支 | 支持分支探索与复用上下文 | 仅长期实验参考 |
| 会话分类 | 自定义标签，给对话打分类，支持导入/导出 | 解决大量会话无法管理的问题 | 可借鉴本地标签思路 |
| 搜索 | 按标题实时搜索对话历史，支持关键词高亮 | 提升历史会话找回效率 | 可借鉴本地索引思路 |
| 导出 | 导出对话为 JSON 或 Markdown | 便于备份、迁移、复盘 | 可借鉴当前会话导出 |
| 批量重命名 | 直接重命名、前缀/后缀、查找替换、序号命名 | 适合整理大量实验会话 | 不建议早期照搬 |
| 快捷键 | `Ctrl+Shift+D` 打开面板 | 降低操作入口摩擦 | 可借鉴 |

从产品角度看，它优先解决的是“DeepSeek 官方 Web 产品没有做好重度用户的会话组织能力”。这类能力与 MCP 工具调用不是强耦合，但和“网页端开发项目”场景高度相关，因为项目开发会产生大量长会话、调试会话、分支讨论和导出记录。

当前项目可以吸收其中的“本地组织能力”，但不应早期复刻其“直接调用平台内部 API”的路径。

### 2.2 DS MCP Bridge：本地工具调用

`ds-mcp-bridge` 的核心能力包括：

| 功能 | 说明 | 风险/注意点 |
|---|---|---|
| SSE 拦截 | 拦截 DeepSeek 流式响应并检测工具调用 | 依赖平台响应格式 |
| 工具调用检测 | 支持 DeepSeek 原生 SSE 与 OpenAI 兼容格式；CHANGELOG 提到 flex match | 需要处理 token 边界截断 |
| 自动注入工具结果 | 工具执行后通过聊天输入框发回 DeepSeek | 依赖输入框和发送按钮稳定性 |
| 本地 FastAPI server | HTTP → JSON-RPC 2.0 → 工具执行 | 浏览器脚本与本地能力解耦 |
| 内置工具 | shell、文件读写、搜索、网页抓取 | 强能力默认暴露会提高安全风险 |
| 外部 MCP server | 支持 stdio 和 HTTP endpoint 接入第三方 MCP server，并能兼容部分 SSE 响应 | 需要权限、审计和命名空间治理 |
| 控制面板 | 状态、测试、设置等 Tab | 提升可观察性和手动调试体验 |

它的定位接近“让 DeepSeek 具备本地 agent 能力”。相比本项目当前 v0.1，它已经覆盖了更强的工具集合和外部 MCP 接入，但安全治理相对更偏工程级保护，而不是产品级权限策略。

---

## 3. 架构拆解

### 3.1 总体结构

README 中给出的结构大致如下：

```text
DeepSeek Chat 浏览器页面
  ↓ userscript 拦截 SSE / 检测工具调用
  ↓ GM_xmlhttpRequest / localhost HTTP
本地 MCP Server FastAPI
  ↓ JSON-RPC 2.0
内置工具 / 外部 MCP Server
```

项目目录体现出三层结构：

```text
DeepseekWeb-enhance/
├─ ds-enhance.user.js          # 会话管理 userscript
├─ ds-mcp-bridge.user.js       # MCP 工具桥 userscript
├─ shared/shared-header.js     # 共享 UI 基础设施
└─ server/
   ├─ server.py                # FastAPI 服务与 JSON-RPC 入口
   ├─ tools/shell.py           # 本地 shell / 文件工具
   ├─ tools/search.py          # 搜索 / 网页抓取工具
   ├─ tools/mcp_external.py    # 外部 MCP server 代理
   ├─ mcp.json                 # server 配置
   ├─ presets.json             # 外部 MCP server 预设
   └─ tests/                   # pytest 测试
```

### 3.2 Browser Userscript 层

虽然没有完整读取两个 userscript 文件，但 README、CHANGELOG 和 `shared-header.js` 可以还原其设计：

1. 使用 Tampermonkey 作为分发形态。
2. 页面左下角/右下角提供悬浮按钮。
3. 悬浮按钮可拖动。
4. 面板通过 Tab 组织功能。
5. 面板与 toast、modal、progress bar 共用一套 shared infrastructure。
6. 工具桥通过脚本拦截 DeepSeek 请求/响应，并将工具结果重新注入输入框。
7. MCP 客户端通过 `GM_xmlhttpRequest` 绕过浏览器 CORS 限制访问本地服务。

`shared/shared-header.js` 说明了一个重要设计决策：

> userscript 不能像现代前端工程一样自然 import 模块，所以共享代码以“复制并内联”的方式复用。

这对本项目有参考意义：如果继续用 Tampermonkey/userscript 过渡，应避免过度追求模块化工程体验；如果功能继续扩张，应尽快迁移 Chrome Extension，让 content script、page world script、side panel、options page、service worker 有明确边界。

### 3.3 Shared UI 基础设施

`shared-header.js` 抽象了以下基础能力：

| 模块 | 能力 |
|---|---|
| Utilities | HTML escape、日期格式化、下载文件 |
| Toast | 成功/错误/信息提示 |
| Core CSS | FAB、Panel、Tabs、Buttons、Input、Modal、Progress 样式 |
| FAB + Panel | 创建可拖动悬浮球和面板 |
| Tabs | 面板 Tab 切换 |
| Modal | 通用确认弹窗 |
| Progress | 进度条展示 |

这套 shared UI 的产品价值很明确：

1. 两个脚本可以保持一致的交互风格。
2. 不依赖目标网站 DOM 结构插入侧栏，降低页面改版影响。
3. 面板作为独立 UI 层，适合承载状态、设置、测试、历史等工具性功能。

对本项目的参考：

- v0.2 的 panel-side tool card 可以先走类似路线，不急着把复杂卡片嵌入 ChatGPT 消息 DOM。
- FAB + panel 适合 userscript 阶段；Chrome Extension 阶段再迁移 Side Panel / Popup / Options。
- 需要一套统一 UI 基础设施，避免工具状态、权限确认、诊断信息散落在临时代码中。
- 如果进入 Chrome Extension 阶段，建议使用 Shadow DOM 或 isolated stylesheet，而不是直接复用全局 CSS 注入模式。

---

## 4. 本地 Server 设计

### 4.1 FastAPI + JSON-RPC 2.0

`server/server.py` 使用 FastAPI 实现 HTTP 服务，核心入口是 `/mcp`：

- 支持 JSON-RPC 2.0 请求。
- 支持 batch 请求。
- 支持 `initialize`。
- 支持 `tools/list`。
- 支持 `tools/call`。
- 对 notification 返回 202。
- unknown method 返回 `-32601`。

这说明它更接近 MCP 协议服务，而不是只实现一组任意 REST endpoint。

对本项目的启发：

- 当前 gateway 已经有 `/call-tool` 和 `mcp_list` 等内部协议，短期可继续保持简单。
- 如果要接入外部 MCP server，内部可以保持 REST 风格，但外部 adapter 必须正确处理 MCP initialize / tools/list / tools/call。
- 后续可以增加一个标准化 MCP compatibility layer，但不要过早替换已验证可用的本项目协议。

一个细节风险是版本号存在多处硬编码：FastAPI app version 是 `2.0.0`，但 `initialize` 返回的 `serverInfo.version` 是 `1.0.0`。这不影响核心功能，但说明 diagnostics、协议响应和用户文档需要统一版本来源。

### 4.2 Health Endpoint

`/health` 返回：

- `status`
- 工具数量
- builtin tools 数量
- external tools 数量
- external servers 状态
- sessions 数量

这比简单返回 `ok` 更有诊断价值。对本项目来说，health 也应逐步扩展为诊断入口，例如：

```json
{
  "status": "ok",
  "workspaceRoot": "...",
  "trustedLocalMode": true,
  "tools": {
    "total": 8,
    "enabled": 6,
    "disabled": 2
  },
  "externalMcp": {
    "servers": 0,
    "tools": 0
  },
  "lastAuditLog": "..."
}
```

### 4.3 Session 管理

`server.py` 内部维护 sessions：

- initialize 时创建 session。
- session 30 分钟过期。
- session 最大数量 100。
- 超时和超过数量时清理。

但这套 session 更像 initialize 记录与 cleanup 示例，不是完整的会话鉴权或活动状态追踪。源码中没有看到后续 `tools/list` / `tools/call` 更新 `last_activity`，也没有基于 session id 做调用级校验。

本项目目前未必需要 MCP session，但这个设计给外部 MCP adapter 提供参考。尤其当接入 stdio / HTTP MCP server 时，需要关注：

1. session id 如何传递与校验。
2. 每次调用是否更新 last_activity。
3. server 连接状态如何与 session 状态区分。
4. server 重启后工具列表如何刷新。
5. 长时间闲置后的资源如何回收。

### 4.4 本地服务暴露面风险

这是该仓库最需要谨慎看待的安全点之一。

`server.py` 在配置缺失时默认使用：

```json
{"server": {"host": "0.0.0.0", "port": 8024}, "services": {}}
```

同时 CORS 中间件配置为：

```python
allow_origins=["*"],
allow_methods=["*"],
allow_headers=["*"]
```

这意味着如果用户以默认 host 启动，并且网络环境允许访问，服务可能不只是“本机页面可访问”，而是存在更大的局域网暴露面。再叠加 shell、read_file、write_file、external MCP server 等强能力，风险明显高于普通本地诊断服务。

本项目不应照搬这个默认值。建议默认策略：

```text
host = 127.0.0.1
CORS origin allowlist = chatgpt.com / extension origin / localhost dev origin
local access token = required
remote bind = disabled by default
```

如果未来支持 `0.0.0.0` 或远程访问，必须显式开启，并在 UI 中给出风险提示。

---

## 5. 内置工具层设计

### 5.1 shell.py 工具列表

`shell.py` 提供：

| 工具 | 说明 |
|---|---|
| `execute_command` | 执行 shell 命令 |
| `get_cwd` | 获取 workspace 路径 |
| `list_directory` | 列目录 |
| `read_file` | 读文件 |
| `write_file` | 写文件 |

这些工具通过 `TOOL_DEFINITIONS` 暴露 inputSchema，通过 `HANDLERS` 映射实际执行函数。

### 5.2 基础安全策略

`shell.py` 已经具备基础安全策略：

1. `WORKSPACE_ROOT` 限制在 `DS_WORKSPACE` 或当前工作目录。
2. `_validate_path` 使用 `Path.resolve()` 后检查是否在 workspace 内。
3. `execute_command` 通过 `DANGEROUS_PATTERNS` 阻断部分危险命令。
4. 命令有 timeout，默认 30 秒。
5. `read_file` 有 `max_bytes` 限制，默认 1MB。
6. `read_file` 处理 decode error。
7. `list_directory` 处理 permission error。
8. `test_presets.py` 中至少覆盖了 `taskkill`、`kill`、`pkill` 的阻断测试。

需要注意的是，这些保护是“工程层基础保护”，还不等于完整产品安全模型。

### 5.3 风险点

| 风险点 | 说明 | 对本项目的启发 |
|---|---|---|
| `execute_command` 自由命令 | 即使有 dangerous pattern，也难覆盖所有危险命令 | 本项目应优先做 `run_task` 白名单，而不是任意 shell |
| `write_file` 直接落盘 | 缺少 proposal / diff / confirm 主流程 | 本项目正式写入必须 proposal 化 |
| workspace 默认 cwd | 如果用户在错误目录启动，可能扩大可访问范围 | 本项目必须强调 workspaceRoot 配置，不指向用户根目录 |
| pattern blocklist 不完备 | blocklist 无法覆盖所有破坏性命令 | 本项目应采用 allowlist + confirm + audit |
| 输出直接返回 | 大输出可能撑爆上下文 | 本项目需 result cache / pagination |
| Windows 语义不足 | pattern 中包含 `taskkill`，但未形成完整 Windows 安全策略 | 本项目如主打 Windows，应单独设计 PowerShell / cmd 安全策略 |

---

## 6. 外部 MCP Server 设计

`server/tools/mcp_external.py` 是该仓库最值得重点参考的部分之一。

### 6.1 支持两类传输

| 传输 | 配置方式 | 说明 |
|---|---|---|
| stdio | `command` + `args` + `env` | 启动子进程，通过 stdin/stdout JSON-RPC 通信 |
| HTTP endpoint | `url` + `headers` | 通过 HTTP POST 连接远程或本地 MCP endpoint，可兼容部分 `text/event-stream` 响应 |

配置示例：

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "..." }
    },
    "my-remote": {
      "url": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

### 6.2 stdio MCP Server 生命周期

`StdioMCPServer` 包含：

1. 启动 subprocess。
2. 建立 read loop。
3. 发送 `initialize`。
4. 发送 `notifications/initialized`。
5. 调用 `tools/list`。
6. 缓存工具列表。
7. `tools/call` 时路由到子进程。
8. stop 时 terminate / kill。

关键实现点：

- `_next_id` 管理 JSON-RPC id。
- `_pending` 记录等待响应的 Future。
- `_read_loop` 从 stdout 持续读取 JSON-RPC 响应。
- timeout 防止调用永久挂起。

对本项目的启发：

- v0.2 Spike 可以先复刻最小 stdio initialize / tools/list / tools/call。
- 必须设计 server stop / restart / status。
- stderr 日志不能直接混入 stdout JSON-RPC；需要单独收集或展示。
- 工具列表需要命名空间化，避免外部工具覆盖内置工具。

当前实现还有一个细节风险：`asyncio.create_subprocess_exec(..., stderr=asyncio.subprocess.PIPE)` 创建了 stderr pipe，但源码中没有看到单独 drain 或收集 stderr 的任务。外部 MCP server 如果持续写 stderr，可能影响诊断，极端情况下也可能阻塞子进程。本项目实现 stdio adapter 时应单独消费 stderr，并把最近 stderr 摘要暴露给 diagnostics。

### 6.3 HTTP MCP Server

`HTTPMCPServer` 支持：

1. initialize。
2. 保存 session id。
3. 发送 initialized notification。
4. tools/list。
5. tools/call。
6. 处理 `application/json` 响应。
7. 当响应 `content-type` 包含 `text/event-stream` 时，解析第一个 `data:` 事件。
8. 支持 `Mcp-Session-Id` header。

这更准确地说是“HTTP transport with SSE response parsing”，不是完整的长连接 SSE client，也不是完整 streamable transport 实现。它的参考价值在于：P1 可以兼容 HTTP/SSE 响应形态，但 P0 不必一开始做完整远程 transport。

对本项目的启发：

- HTTP endpoint 支持可以放在 P1，不必 P0。
- P0 只做 stdio，能更好控制本地安全边界。
- 远程 HTTP MCP server 必须默认禁用，并标注远程风险。

### 6.4 ExternalMCPProxy 管理器

`ExternalMCPProxy` 提供：

| 能力 | 说明 |
|---|---|
| load_config | 从配置加载多个 server |
| add_server | 运行时添加 server |
| remove_server | 删除 server 并持久化配置 |
| start_server | 启动停止的 server |
| stop_server | 停止但保留配置 |
| get_server_config | 返回脱敏后的配置 |
| get_all_tools | 聚合所有外部工具 |
| call_tool | 根据 tool name 路由调用 |
| get_status | 返回所有 server 状态 |

一个重要细节是 `get_server_config` 会 mask env 值，避免直接展示 secret。

但有两个对本项目必须规避的问题：

1. 当前实现按原始 tool name 建立 `_tool_to_server`，如果两个外部 server 暴露同名工具，会产生冲突并跳过后者。
2. `server.py` 的 `tools/call` 逻辑会先检查 external tool，再检查 builtin tool。如果外部 MCP server 暴露了与内置工具同名的工具，可能遮蔽内置工具。

本项目应采用 namespace：

```text
builtin.read_file
builtin.list_directory
external.github.create_issue
external.filesystem.read_file
```

这样可以同时避免 external vs external、external vs builtin 的工具名冲突，也利于权限和审计。

---

## 7. Preset 机制

`server/presets.json` 提供了一个轻量 preset marketplace 雏形。

### 7.1 预设内容

包含：

| preset | 分类 | 说明 |
|---|---|---|
| context7 | 开发 | 查询库/框架最新文档 |
| fetch | 网络 | 网页抓取，HTML 转 Markdown |
| memory | AI | 持久化记忆 |
| sequential-thinking | AI | 结构化逐步推理 |
| filesystem | 文件 | 读写本地文件和目录 |
| github | 开发 | 操作 GitHub 仓库、Issue、PR |
| brave-search | 网络 | Brave 搜索 |
| sqlite | 数据 | SQLite 数据库 |

### 7.2 参数模板

preset 支持 `{{PARAM}}` 占位符，例如：

```json
{
  "id": "github",
  "config": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": "{{GITHUB_TOKEN}}"}
  },
  "params": [
    {"key": "GITHUB_TOKEN", "label": "GitHub Token", "required": true, "secret": true}
  ]
}
```

`server.py` 中 `/api/presets/{preset_id}/install` 会：

1. 加载 preset。
2. 校验 required params。
3. 替换占位符。
4. 移除未替换的 env。
5. 如果已安装则先 remove。
6. 调用 `external_proxy.add_server`。

### 7.3 对本项目的启发

本项目短期不应做 store 或 marketplace，但可以设计“本地 preset”能力：

- 常用 MCP server 配置模板。
- secret 参数单独输入。
- 默认 disabled。
- 安装后工具默认 hidden / ask_every_time。
- env 必须脱敏。
- preset 必须有风险提示。
- 对 filesystem、github、sqlite 这类强能力 preset 做 risk classification。

这可以作为 v0.3/P1 或 v0.7 Chrome Extension Options 的一部分。

---

## 8. 测试设计

已读取测试文件包括：

- `server/tests/test_server.py`
- `server/tests/test_management.py`
- `server/tests/test_mcp_external.py`
- `server/tests/test_presets.py`

`server/tests/test_tools.py` 因触发敏感内容保护未能读取。

### 8.1 JSON-RPC 基础测试

`test_server.py` 覆盖：

| 测试 | 覆盖点 |
|---|---|
| `test_health_endpoint` | health 基本结构 |
| `test_mcp_initialize` | initialize 返回 sessionId |
| `test_mcp_tools_list` | tools/list 返回工具列表 |
| `test_mcp_tools_call_get_cwd` | tools/call 正常调用 |
| `test_mcp_unknown_method` | unknown method 返回 -32601 |
| `test_mcp_batch_request` | batch 请求处理 |
| `test_mcp_invalid_json` | invalid JSON 返回 400 |
| `test_session_cleanup_on_initialize` | session cleanup |

### 8.2 外部 MCP proxy 测试

`test_mcp_external.py` 覆盖：

| 测试 | 覆盖点 |
|---|---|
| HTTP mocked start | initialize / notification / tools/list 流程 |
| HTTP tool call | tool call 返回 content |
| empty config | 无外部 server 时工具列表为空 |
| invalid config | 缺 command/url 的配置会跳过 |
| stop_all | 清理 server 与 tool mapping |
| call unknown tool | 返回 error |
| empty status | 无 server 时 status 为空数组 |

### 8.3 外部 server 管理 API 测试

`test_management.py` 覆盖：

| 测试 | 覆盖点 |
|---|---|
| list external servers | `/api/external-servers` 基本结构 |
| add missing name | 单服务添加缺 name 返回 400 |
| add invalid JSON | 无效 JSON 返回 400 |
| batch import invalid server | batch import 中单个 server 错误可返回 per-server result |
| remove/start/stop not found | 管理 API 的 not found 行为 |
| health includes external | health 包含 external 字段 |

### 8.4 Preset 与危险命令测试

`test_presets.py` 覆盖：

| 测试 | 覆盖点 |
|---|---|
| list presets | `/api/presets` 基本结构 |
| install missing preset | 不存在 preset 返回 404 |
| install preset missing params | 必填参数缺失返回 400 |
| taskkill blocked | Windows `taskkill` 阻断 |
| kill blocked | `kill` 阻断 |
| pkill blocked | `pkill` 阻断 |

### 8.5 对本项目的启发

1. 外部 MCP adapter 需要类似测试矩阵。
2. batch 行为需要明确 status code / body contract。
3. session / server lifecycle 需要单测覆盖。
4. 安全测试必须补强：路径越界、敏感路径、禁用工具、危险命令、env 脱敏、external vs builtin 工具名冲突、CORS/origin 校验。
5. Windows 环境下应补 PowerShell / cmd 专项测试，而不是只用 Unix 风格命令测试。

---

## 9. 版本演进观察

从 CHANGELOG 看，项目演进路径很快：

```text
DS Enhance v1.0.0：初始脚本
DS Enhance v2.0.0：悬浮控制面板、批量删除、Fork
DS Enhance v3.0.0：分类、搜索、导出、批量重命名
DS MCP Bridge v1.0.0：MCP userscript + server + 内置工具
DS MCP Bridge v2.0.0：SSE 解析、flex match、自动注入结果、发送按钮 fallback
DS MCP Bridge v3.0.0：移除自定义提示词，迁移到 ds-enhance
DS Enhance v3.1.0：自定义系统提示词注入、XHR + fetch hook
Unreleased：外部 MCP server 支持
```

这个演进说明：

1. 初期 userscript 能快速验证功能。
2. 一旦功能增多，面板化 UI 会成为必要。
3. 会话增强和 MCP 桥会自然出现共享能力，如提示词注入、请求拦截、状态面板。
4. 外部 MCP server 是工具桥发展到一定阶段后的必然需求。
5. 功能增长很快时，安全模型、权限模型、测试和文档容易滞后。
6. 快速演进中容易出现版本号、协议描述、权限边界不完全统一的问题。

---

## 10. 对本项目的可借鉴点

### 10.1 应直接借鉴

| 借鉴点 | 落地建议 |
|---|---|
| 会话管理与工具桥共享基础设施 | Browser Layer 做统一面板、toast、diagnostics，但模块边界分离 |
| FAB + panel 作为 userscript 阶段入口 | v0.2 先做 panel-side tool card，不急着做复杂 inline UI |
| FastAPI/HTTP server 与浏览器解耦 | 本项目已有 gateway，可继续强化 REST + tool registry |
| 外部 MCP stdio adapter | v0.2 Spike，v0.3 P0 支持 stdio |
| Preset 模板思路 | 后续 Options 里做本地 MCP server preset，不做 store |
| Health 返回诊断信息 | 扩展 gateway health 和 Copy diagnostics |
| 测试覆盖 JSON-RPC 基础行为 | 为 external MCP adapter 建立协议级测试 |
| 工具结果自动注入 + 发送按钮 fallback | 本项目需要持续强化 input injection / send fallback |

### 10.2 需要谨慎借鉴

| 能力 | 原因 | 本项目策略 |
|---|---|---|
| 直接 `execute_command` | 任意命令风险高 | 改为 `run_task` 白名单 |
| 直接 `write_file` | 缺少 proposal / diff / confirm | 临时自举可用，正式回收为 proposal |
| 外部工具自动合并 | 工具命名冲突、权限不清，且可能覆盖内置工具 | namespace + per-tool policy |
| CORS allow all | 叠加默认 `0.0.0.0` 会放大本地服务暴露面 | 只允许 127.0.0.1 + token/trusted local policy |
| 读取平台内部 token/API | 功能强，但风险和稳定性差 | 会话管理 P0/P1 优先 DOM 可见信息与本地索引 |
| HTTP/SSE adapter | 现有实现只是 HTTP endpoint + 首个 SSE data 兼容 | P1 再做完整 transport 设计 |
| session 管理 | 当前 session 未形成完整调用级校验 | 如引入 session，需补 id 传递、校验、活动更新 |

### 10.3 不建议照搬

1. 不建议默认开放 shell 和 write_file。
2. 不建议把所有外部 MCP 工具直接暴露给模型。
3. 不建议仅依赖 blocklist 判断危险命令。
4. 不建议长期停留在复制内联 userscript 共享代码模式。
5. 不建议将会话删除/批量操作纳入自动化链路。
6. 不建议以 `0.0.0.0 + CORS *` 作为本地工具服务默认配置。
7. 不建议早期依赖 ChatGPT 内部 API 或 token 读取来做会话管理。

---

## 11. 对 PRD vNext 的影响

基于本仓库分析，`docs/prd_vnext.md` 应继续强化以下方向：

### 11.1 v0.2 应强调 panel-side UI

DS Enhance 的 shared UI 证明，在 userscript 阶段，一个独立浮窗面板比深度嵌入目标网页 DOM 更稳。

建议 v0.2 明确：

- Tool call card 放在 panel。
- Result card 放在 panel。
- ChatGPT 消息区最多显示轻量 badge，不做复杂交互。
- 复杂 UI 迁移到 Chrome Extension Side Panel 后再做。

### 11.2 v0.3 外部 MCP Adapter 要早做，但先做 stdio

DS MCP Bridge 已经支持外部 MCP server，说明这不是遥远能力，而是竞品核心路线。

建议本项目：

- v0.2 做 stdio Spike。
- v0.3 做最小 stdio adapter。
- HTTP endpoint / SSE response parsing 放 P1。
- 完整 remote transport 放更后。
- namespace、permission、audit 从一开始纳入。
- external vs builtin 工具名冲突必须在 schema 层避免。

### 11.3 临时 write_file 必须明确回收

DS MCP Bridge 直接暴露 write_file，能快速开发，但这也是安全争议点。本项目当前也临时启用了 `write_file` 自举能力，因此必须在文档中明确：

- 它是 development escape hatch。
- 默认 high risk。
- requires confirmation。
- 后续由 proposal 主路径替代。
- apply 前应做 hash 校验或 diff preview。

### 11.4 会话管理应分阶段

DS Enhance 的会话管理能力很完整，但 ChatGPT Web 的可行性与风险不同。建议本项目拆成：

- P0：当前会话导出、tool history、snapshot、本地标签。
- P1：本地索引、搜索、标题 proposal、分类 proposal。
- P2：内部 API 实验，仅 experimental，默认关闭。
- P3：Fork / 批量删除 / 官方会话管理类能力，除非有明确安全与合规设计，否则不进入主线。

### 11.5 诊断和测试要更早进入路线

DS MCP Bridge 有控制面板、测试 Tab、health endpoint、pytest 测试。对本项目来说，诊断不是附属功能，而是核心体验。

建议：

- v0.1.1 增加 `docs/troubleshooting.md`。
- v0.2 增加 Copy diagnostics。
- gateway health 返回更完整状态。
- external MCP adapter 有协议级测试。
- CORS、host binding、token 校验、安全工具策略纳入测试矩阵。

---

## 12. 建议转化为本项目任务

### 12.1 近期任务

| 任务 | 来源启发 | 优先级 |
|---|---|---|
| 写 `docs/troubleshooting.md` | mcp-bridge / DS 面板诊断 | P0 |
| 标注 `write_file` 自举边界 | DS 直接 write_file 风险 | P0 |
| 增加 panel-side tool card | shared-header 面板框架 | P0 |
| 增加 Copy diagnostics | health + status panel | P0 |
| external MCP stdio Spike | `mcp_external.py` | P0 |
| 工具 namespace 设计 | 外部 tool conflict / external 覆盖 builtin 风险 | P0 |
| 本地服务安全默认值 | `0.0.0.0 + CORS *` 风险 | P0 |

### 12.2 中期任务

| 任务 | 来源启发 | 优先级 |
|---|---|---|
| MCP server preset 本地模板 | `presets.json` | P1 |
| Tool policy options page | shared panel + external tools | P1 |
| 当前会话导出与本地标签 | ds-enhance | P1 |
| run_task 白名单 | shell execute_command 风险 | P1 |
| result cache | 大结果问题 | P1 |
| stderr diagnostics | stdio subprocess stderr 未读取风险 | P1 |
| external server lifecycle tests | test_mcp_external / test_management | P1 |

### 12.3 长期任务

| 任务 | 来源启发 | 优先级 |
|---|---|---|
| Chrome Extension Side Panel | userscript 扩张瓶颈 | P2 |
| 外部 HTTP endpoint / SSE response parsing | `HTTPMCPServer` | P2 |
| 当前会话 Branch / Snapshot | DS Enhance Fork 的低风险替代 | P2 |
| 内部 API 实验 | DS Enhance 内部 API 调用 | P2/P3 experimental |
| 官方会话 Fork / 批量删除 | DS Enhance 高风险能力 | P3，不进入默认主线 |

---

## 13. 总结

`DeepseekWeb-enhance` 对本项目最重要的参考价值是：

1. 它证明了“会话增强 + 本地工具桥”是一个自然组合。
2. 它证明了 userscript 可以快速跑通浏览器增强，但功能复杂后会需要统一面板和共享基础设施。
3. 它证明了外部 MCP server 接入是工具桥路线中的关键节点。
4. 它也暴露了强工具直接开放带来的安全治理压力。
5. 它提醒本项目尽早处理 local server 暴露面、工具命名空间、diagnostics、测试矩阵和写入 proposal。

本项目如果要吸收它的优点，同时形成差异化，应坚持：

- 比它更安全：默认只读、写入 proposal、命令白名单、外部工具 ask every time。
- 比它更适合 ChatGPT Web：深度适配 ChatGPT 的 request injection、DOM detection、result insertion、send fallback。
- 比它更适合开发工作流：围绕 workspace、diff、test、build、audit 设计闭环。
- 比它更可维护：尽快从 userscript 原型演进到 Chrome Extension 架构。
- 比它更严格：本地 server 默认只绑定 `127.0.0.1`，不采用 `0.0.0.0 + CORS *` 作为默认策略。

一句话：

> DeepseekWeb-enhance 可以作为 userscript 原型、共享 UI、FastAPI bridge、外部 MCP stdio adapter 和 preset 机制的参考；但不能照搬它的安全默认值、直接写文件、任意 shell、内部 API 会话管理和外部工具自动合并策略。

下一步建议继续单仓库分析 `mcp-bridge`，重点拆解其四层 fallback、平台配置化、Chrome Extension 结构、缓存与用户文档体系。
