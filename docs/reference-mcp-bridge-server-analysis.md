# mcp_bridge_server 参考仓库分析与解构

## 0. 文档信息

- 参考仓库：`tmp/reference/mcp_bridge_server`
- 分析对象：`README.md`、`utils/mcp_bridge.py`、`docs/PORT_MANAGEMENT.md`、`docs/RESTART_SERVER_GUIDE.md`、`docs/PACKAGING_GUIDE.md`、启动脚本与打包说明
- 输出文件：`docs/reference-mcp-bridge-server-analysis.md`
- 目标用途：补齐第五个参考仓库的逐仓库分析，重点为本项目的 Local Gateway、外部 MCP server 管理、REST API 契约、端口管理、缓存系统、服务生命周期、Windows 分发和安全边界提供参考
- 分析日期：2026-04-26

---

## 1. 总体判断

`mcp_bridge_server` 是 `mcp-bridge` 浏览器扩展对应的本地桥接服务端。它不是浏览器侧适配项目，而是一个 Python FastAPI 本地网关，核心职责是：

```text
Chrome Extension
  → HTTP REST API
    → MCP Bridge Server
      → stdio / SSE MCP servers
        → tools/list / tools/call
```

它对本项目的价值非常直接：本项目当前也有本地 Gateway，因此 `mcp_bridge_server` 可以作为 Local Gateway 侧的主要参考，而 `mcp-bridge` 则是浏览器 Extension 侧参考。

对本项目最有参考价值的部分主要有八类：

1. **外部 MCP server 管理**：通过 `mcp-config.json` 管理多个 MCP server，支持 `stdio` 与 `sse` 两类连接。
2. **分层工具发现**：`GET /tools` 先返回服务列表，`GET /tools?serverName=` 再返回某个服务下的工具详情，减少 prompt 暴露体积。
3. **REST API 契约**：健康检查、工具列表、工具执行、配置读写、服务重启、服务关闭、缓存读取、缓存搜索等接口完整。
4. **服务生命周期**：支持全局 reload、单服务 restart、单服务 shutdown，适合 Options Page 管理外部服务。
5. **大结果缓存**：超过阈值后返回 `cached_reference`，支持内存/文件两级缓存、分段读取、搜索和行上下文。
6. **端口管理**：启动前检查端口占用，支持交互式处理、自定义端口和自动结束占用进程。
7. **Windows 分发经验**：提供 `.bat` 启动脚本、PyInstaller 打包、控制台版本建议、Release 命名和 SHA256 校验。
8. **错误回传**：工具执行失败时返回错误类型和 Python traceback，便于浏览器端展示给模型或用户诊断。

但它也有一些本项目不能直接照搬的点：

- 默认 `uvicorn` 监听 `0.0.0.0`，本项目安全默认应只监听 `127.0.0.1`。
- CORS `allow_origins=["*"]` 过宽，本项目应限制为 ChatGPT 扩展、localhost 或明确允许来源。
- `--auto-kill-port` 会结束占用端口的进程，适合开发便利，但必须默认关闭并强提示风险。
- 外部 MCP tool 默认可执行，缺少本项目需要的 `modelVisibility`、`executionPolicy`、风险等级和审计策略。
- `POST /config` 可直接更新配置并重载，正式产品应加 schema validation、secret redaction、diff preview 和确认。
- traceback 直接返回给前端虽然有利诊断，但可能泄露路径、环境变量或内部实现细节，需要脱敏。

因此，`mcp_bridge_server` 应作为本项目 **Local Gateway / External MCP Adapter / Result Cache / Windows 分发** 的核心参考，但必须套上更严格的安全策略。

---

## 2. 仓库结构解构

从目录看，该仓库非常聚焦：

```text
tmp/reference/mcp_bridge_server/
├── README.md
├── requirements.txt
├── version.py
├── utils/
│   └── mcp_bridge.py
├── docs/
│   ├── PACKAGING_GUIDE.md
│   ├── PORT_MANAGEMENT.md
│   └── RESTART_SERVER_GUIDE.md
├── build.bat
├── build.sh
├── start.bat
├── start.sh
├── mcp_bridge.spec
└── test_restart_server.py
```

它不是 monorepo，也不是扩展项目，而是一个可单独分发的本地服务。

| 模块 | 观察 | 对本项目的意义 |
|---|---|---|
| `utils/mcp_bridge.py` | FastAPI + MCP SDK + stdio/SSE client + cache + service lifecycle | 本项目 Gateway 侧最直接参考 |
| `README.md` | 快速开始、配置、API、缓存说明完整 | 本项目后续 `docs/external-mcp.md` 可借鉴结构 |
| `PORT_MANAGEMENT.md` | 端口检测、占用进程识别、自动处理 | 本项目 Windows 开发体验可借鉴，但安全默认要更保守 |
| `RESTART_SERVER_GUIDE.md` | 单服务重启/关闭 API 与场景 | Options Page 服务管理可借鉴 |
| `PACKAGING_GUIDE.md` | PyInstaller 打包、Release、校验和 | 本项目 Gateway 桌面分发可借鉴 |
| `start.bat` / `start.sh` | 面向用户的启动入口 | 本项目 Windows-first 体验应重视 |
| `mcp_bridge.spec` | PyInstaller 配置 | 后续独立可执行文件阶段参考 |

---

## 3. 产品定位分析

### 3.1 它是 mcp-bridge 的 Local Backend

`README.md` 将项目定义为 MCP Bridge 浏览器扩展的本地桥接服务，通过 HTTP REST API 与扩展通信，动态启动、管理和调用一个或多个 MCP 服务进程。

这说明它的定位不是“提供一组内置工具”，而是：

```text
外部 MCP server 管理器 + HTTP proxy + result cache + lifecycle manager
```

这和本项目当前 Gateway 有明显差异。本项目当前更像：

```text
内置本地只读工具 + ChatGPT Web bridge gateway
```

vNext 后如果要支持外部 MCP server，`mcp_bridge_server` 的抽象就很值得吸收。

### 3.2 本项目不应把 Gateway 做成纯 MCP proxy

`mcp_bridge_server` 的核心是代理外部 MCP server，而本项目的差异化是安全优先本地开发工作流。因此本项目 Gateway 应该包含：

```text
Gateway = builtin tools + external MCP adapter + policy engine + audit log + proposal store + result cache
```

而不只是：

```text
Gateway = external MCP proxy
```

也就是说，`mcp_bridge_server` 更适合作为 External MCP Adapter 的参考，而不是替代本项目 Gateway。

---

## 4. 技术栈与服务端形态

### 4.1 Python FastAPI + MCP SDK

`utils/mcp_bridge.py` 使用：

```text
FastAPI
uvicorn
pydantic
mcp.ClientSession
mcp.client.stdio.stdio_client
mcp.client.sse.sse_client
```

这是一条清晰的本地服务路线：

```text
HTTP REST API
  → MCP SDK ClientSession
    → stdio / SSE transport
      → MCP tool call
```

对本项目的启发：

- 外部 MCP 接入没必要在浏览器端直接实现 stdio。
- stdio MCP 必须由本地 Gateway 代理。
- 浏览器侧只需要 HTTP 调 Gateway。
- Gateway 侧应集中处理 MCP initialize、tools/list、tools/call、timeout、error mapping。

### 4.2 Pydantic 配置模型

代码定义了：

```text
MCPServerConfig
Config
ExecuteRequest
ConfigUpdateRequest
ServerRestartRequest
GetResultRequest
SearchCacheRequest
GetCacheContextRequest
```

这说明它把 API request body 和配置做了基本类型建模。字段包括：

```text
enabled / disabled
type: stdio | sse
command / args / env
url
timeout
description
max_output_bytes
output_truncate_strategy
cache_large_results
result_cache_ttl
max_memory_cache_size
```

本项目可以借鉴字段，但需要进一步补充安全字段：

```json
{
  "enabled": false,
  "modelVisibility": "hidden",
  "defaultExecutionPolicy": "ask_every_time",
  "risk": "unknown",
  "allowedWorkspaceRoots": [],
  "secretEnvKeys": [],
  "audit": true
}
```

### 4.3 监听地址问题

代码中 uvicorn 使用：

```python
uvicorn.run(app, host="0.0.0.0", port=PORT)
```

这意味着同一局域网内其他设备也可能访问该服务，具体取决于系统防火墙。本项目不应采用这个默认值。

本项目建议：

```text
P0/P1: host = 127.0.0.1 only
显式 --host 0.0.0.0 才允许局域网访问
启用 0.0.0.0 时必须展示高风险提示
```

---

## 5. 外部 MCP Server 配置模型

### 5.1 配置文件位置

首次运行会在系统用户目录创建配置：

| 系统 | 路径 |
|---|---|
| Windows | `%APPDATA%\mcp-bridge\config\mcp-config.json` |
| macOS | `~/Library/Application Support/mcp-bridge/config/mcp-config.json` |
| Linux | `~/.config/mcp-bridge/config/mcp-config.json` |

这对本项目很有价值，尤其用户只用 Windows 时，本项目应优先设计：

```text
%APPDATA%\chatgpt-web-local-agent-bridge\config\gateway.json
%APPDATA%\chatgpt-web-local-agent-bridge\logs\audit.jsonl
%APPDATA%\chatgpt-web-local-agent-bridge\cache\...
```

避免把用户配置散落在项目目录里。

### 5.2 配置结构

示例结构：

```json
{
  "mcpServers": {
    "filesystem": {
      "enabled": true,
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:\\Users\\YourName\\Documents"],
      "description": "提供文件系统访问能力，可以读写指定目录下的文件",
      "env": {}
    }
  }
}
```

字段说明中强调 `description` 很重要，因为模型根据服务描述判断是否使用服务。这一点和 `mcp-bridge` 浏览器侧的“分层工具发现”配套。

本项目可吸收：

```text
server description 是模型可见 catalog 的核心字段
tool description 是二级工具发现的核心字段
```

但需要注意：模型可见描述必须经过用户启用和 policy engine 过滤，不能把所有配置里的 server 都暴露给模型。

### 5.3 stdio 与 SSE

代码支持：

```text
type = stdio
  command + args + env

type = sse
  url
```

这比本项目 vNext 中设想的“v0.3 先 stdio，HTTP/SSE 后置”更激进一些。本项目建议仍按安全优先：

```text
P0 external MCP: stdio via local gateway
P1: local SSE / streamable HTTP
P2: remote SSE / HTTP，默认 disabled + ask every time
```

远程 MCP server 不能和本地 stdio server 同等默认处理。

---

## 6. API 契约分析

### 6.1 Health

```text
GET /health
→ { "status": "ok", "timestamp": ... }
```

该接口足够做基本连接检测，但对本项目不够。本项目 Gateway health 应返回更完整信息：

```json
{
  "ok": true,
  "version": "0.x",
  "workspaceRoot": "...",
  "trustedLocalMode": true,
  "tools": { "total": 8, "enabled": 6 },
  "externalMcpServers": { "total": 2, "running": 1 },
  "policyVersion": "...",
  "lastError": null
}
```

### 6.2 Tools：两阶段发现

`GET /tools` 无参数返回服务列表：

```json
{
  "success": true,
  "services": [
    {
      "name": "filesystem",
      "description": "..."
    }
  ]
}
```

`GET /tools?serverName=filesystem` 返回该服务工具：

```json
{
  "success": true,
  "tools": {
    "service_name": "filesystem",
    "service_description": "...",
    "tools": [
      {
        "name": "read_file",
        "description": "...",
        "parameters": {}
      }
    ]
  }
}
```

这是非常重要的设计。它适合外部 MCP server 多、工具多、初始 prompt 不宜过大的场景。

本项目建议采用更明确的三层：

```text
GET /catalog
  → 返回对模型可见的内置工具 + 已启用 server summary

GET /external-servers
  → 返回 UI 可见 server 列表和状态

GET /external-servers/{serverName}/tools
  → 返回某个 server 下通过 policy 过滤后的工具
```

并区分：

```text
model catalog
UI tools list
raw MCP tools list
```

### 6.3 Tool detail

代码提供：

```text
GET /tool-detail?toolName=<name>&serverName=<name>
```

返回完整 input schema。这个接口对调试很有价值。本项目可吸收为：

```text
GET /tools/{namespace}/{toolName}
```

返回：

```json
{
  "manifest": {},
  "policy": {},
  "rawInputSchema": {},
  "source": "builtin|external",
  "serverName": "..."
}
```

### 6.4 Execute

```text
POST /execute
body: { "name": "tool_name", "arguments": {}, "serverName": "optional" }
```

它支持不传 serverName，在所有服务中查找；如果多个服务有同名工具，会使用第一个并打印警告。

本项目不建议这种行为。正式设计应要求命名空间化：

```text
builtin.read_file
external.filesystem.read_file
external.github.create_issue
```

同名工具不能自动选择第一个，否则在模型自动执行链路里容易调用错工具。

建议本项目 contract：

```json
{
  "callId": "...",
  "toolName": "external.filesystem.read_file",
  "arguments": {},
  "sourceMessageId": "...",
  "policyContext": {
    "requestedBy": "model",
    "detectionSource": "stream"
  }
}
```

### 6.5 Config read/write

```text
GET /config
POST /config
POST /reload
```

这对 Options Page 很方便，但本项目需要更谨慎：

- `GET /config` 返回时要脱敏 env。
- `POST /config` 保存前必须 schema validation。
- 保存前最好有 diff preview。
- 默认新增 server 必须 disabled。
- env 中疑似 secret 字段必须隐藏展示。
- 更新配置必须写 audit log。

### 6.6 Service lifecycle

```text
POST /restart-server
POST /shutdown-server
POST /reset-history
```

这些接口很适合本项目外部 MCP 管理 UI。

本项目建议新增：

```text
POST /servers/{serverName}/start
POST /servers/{serverName}/stop
POST /servers/{serverName}/restart
POST /servers/{serverName}/refresh-tools
GET  /servers/{serverName}/status
```

比当前 `restart-server` / `shutdown-server` 更 RESTful，也便于 Side Panel/Options Page 对应操作。

---

## 7. MCP Server 初始化与生命周期

### 7.1 初始化流程

代码中的 `init_all_servers()` 会遍历配置中的 `mcpServers`，跳过 `enabled=false` 的服务，然后并发初始化。

单个 stdio server 初始化流程：

```text
读取 command / args / env
→ 合并 os.environ 与 env
→ StdioServerParameters
→ stdio_client(...).__aenter__()
→ ClientSession(...).__aenter__()
→ session.initialize()
→ session.list_tools()
→ 保存 session / context / tools / config
```

SSE server 初始化流程类似：

```text
读取 url
→ sse_client(url).__aenter__()
→ ClientSession(...).__aenter__()
→ session.initialize()
→ session.list_tools()
→ 保存 session / context / tools / config
```

本项目可吸收：MCP external adapter 需要明确保存：

```text
server type
session
transport context
tools snapshot
config snapshot
status
last error
last initialized time
```

### 7.2 Timeout

配置中每个 server 有 `timeout`，默认 30 秒。初始化、list_tools 都使用 `asyncio.wait_for`。

本项目应保留 timeout，并按操作区分：

```text
initializeTimeoutMs
toolsListTimeoutMs
toolCallTimeoutMs
shutdownTimeoutMs
```

不要一个 timeout 管所有场景。

### 7.3 环境变量合并

代码使用：

```python
server_env = {**os.environ, **env}
```

这很方便，但安全上较宽：子进程继承了主进程环境变量。

本项目建议：

```text
默认最小化环境变量
允许用户显式选择 inheritEnv=true
env 展示和 audit 必须脱敏
常见 secret key 默认 redacted
```

尤其是 Windows 开发环境中，用户可能在系统环境变量中存有 token、API key，不应默认全部传给外部 MCP server。

### 7.4 调用次数限制与熔断

代码中 `tool_call_history` 对每个 `server:tool` 失败调用计数，失败 3 次后拒绝继续调用，成功后重置。

这相当于一个很轻量的熔断机制。它能防止模型反复调用失败工具。

本项目可以吸收但需要更明确：

```text
- consecutiveFailureCount
- circuitBreakerOpenUntil
- user can reset
- model-visible error tells retry later / fix args
- UI shows failure count
```

不要只在内存中静默计数。

---

## 8. 大结果缓存机制

这是 `mcp_bridge_server` 最值得本项目直接吸收的设计之一。

### 8.1 触发条件

配置字段：

```text
max_output_bytes: 1000
cache_large_results: true
result_cache_ttl: 300
max_memory_cache_size: 10240
```

当工具结果序列化后的字节数超过 `max_output_bytes`，返回：

```json
{
  "result_type": "cached_reference",
  "cache_id": "uuid",
  "cache_type": "memory|file",
  "total_size": 30520,
  "message": "结果过大..."
}
```

否则返回：

```json
{
  "result_type": "direct",
  "result": {}
}
```

本项目应该采用类似思想，但命名建议统一到已有 vNext：

```json
{
  "resultType": "cached_reference",
  "resultId": "...",
  "sourceTool": "grep_files",
  "summary": "Found 248 matches in 32 files.",
  "totalSizeChars": 30520,
  "expiresAt": "..."
}
```

### 8.2 内存/文件两级缓存

代码策略：

- 结果小于 `max_memory_cache_size`：存内存 `OrderedDict`，最多 100 项，LRU。
- 结果更大：写入用户缓存目录文件，附 `.meta` 元数据，含创建时间、过期时间、大小。

这比简单截断更合理。对本项目而言，grep、日志、构建输出都很容易触发大结果，所以 result cache 应尽早设计，而不是等后期。

### 8.3 分段读取

接口：

```text
GET /result/{cache_id}?start=0&end=10000
POST /result
```

返回：

```json
{
  "success": true,
  "result": "...",
  "metadata": {
    "total_length": 30520,
    "start": 0,
    "end": 10000,
    "has_more": true
  }
}
```

本项目建议工具名：

```text
get_result_page
```

并支持结构化结果按 item 分页，不只按字符分页。

### 8.4 缓存搜索

接口：

```text
POST /search-cache
body: { cache_id, keyword, case_sensitive, max_results }
```

文件缓存搜索使用流式读取，避免大文件一次性进内存。返回匹配行号、列号和片段。

本项目建议工具名：

```text
search_result
```

并将返回结构标准化：

```json
{
  "resultId": "...",
  "query": "...",
  "matches": [
    {
      "itemIndex": 12,
      "line": 23,
      "column": 45,
      "preview": "..."
    }
  ],
  "truncated": false
}
```

### 8.5 行上下文

接口：

```text
POST /get-cache-context
body: { cache_id, line_num, context_lines }
```

返回目标行附近内容。这非常适合日志和文件搜索场景。

本项目建议工具名：

```text
get_context_lines
```

这应成为 v0.8 result cache 的核心能力。

---

## 9. 端口管理与启动体验

### 9.1 端口检测

`PORT_MANAGEMENT.md` 和代码实现提供：

- 默认端口 3849。
- 启动前检查端口是否占用。
- Windows 使用 `netstat -ano` + `tasklist` 获取进程。
- Linux/macOS 使用 `lsof` + `ps`。
- 交互式选项：结束进程、换端口、退出。
- 命令行参数：`--port`、`--auto-kill-port`、`--config`。
- 环境变量：`MCP_AUTO_KILL_PORT`、`MCP_CONFIG_PATH`。

这对本项目的 Windows-first 体验非常有用。本项目不应让用户遇到“端口被占用”就看 traceback。

### 9.2 自动结束进程的风险

`--auto-kill-port` 适合快速开发和自动化，但风险明显。它可能结束并非本项目启动的进程。

本项目建议：

```text
默认：检测到端口占用 → 展示进程信息 → 退出或让用户换端口
开发模式：允许 --auto-kill-port，但必须打印明确风险
安全模式：只自动结束已确认是本项目旧 gateway 的进程
```

更稳的做法：gateway 启动时写 pid file：

```text
%APPDATA%\...\gateway.pid
```

自动重启只杀 pid file 指向且进程命令行匹配本项目的进程，避免误杀。

### 9.3 监听端口建议

`mcp_bridge_server` 默认 3849。本项目当前如果已有端口，例如 8024，则应在文档里固定默认端口，并支持用户覆盖。

建议：

```text
Default: http://127.0.0.1:8024
Configurable via --port and gateway config
Options Page shows current base URL
```

---

## 10. 单服务重启与关闭

### 10.1 设计价值

`RESTART_SERVER_GUIDE.md` 强调可以单独重启或关闭某个 MCP 服务，而不影响其他服务。

这对外部 MCP server 管理很重要。用户经常只改了一个 server 的 command/args/env，没有必要全量 reload。

### 10.2 API 设计

```text
POST /restart-server
body: { serverName, config? }

POST /shutdown-server
body: { serverName }
```

重启流程：

```text
shutdown_server(serverName)
→ sleep 0.5s
→ init_server(serverName, config)
```

它还特别处理了异步 context manager 的清理问题，避免 `Attempted to exit cancel scope in a different task than it was entered in`。

本项目可吸收：

- 单 server restart 是 Options Page 必备能力。
- restart 不应影响其他 external MCP server。
- 重启失败要保留 lastError。
- 重启会中断当前工具调用，应在 UI 提示。
- 重启行为应写入 audit / event log。

### 10.3 本项目建议的状态字段

```json
{
  "serverName": "filesystem",
  "status": "disabled|starting|running|stopping|error",
  "toolCount": 5,
  "lastStartedAt": "...",
  "lastError": null,
  "configHash": "..."
}
```

这样 Options Page 能清楚显示外部服务状态。

---

## 11. Windows 打包与分发

### 11.1 PyInstaller 单文件

`PACKAGING_GUIDE.md` 推荐使用 PyInstaller，将 Python 服务打包成独立可执行文件。

关键建议：

- 使用 `--onefile` 便于分发。
- 不推荐 Windows `--noconsole`，因为用户需要看到日志和端口交互。
- 可以提供控制台版本和 silent 版本。
- 打包时声明 hidden imports：`mcp`、`fastapi`、`uvicorn`、`pydantic` 等。
- Release 中提供多平台文件和 SHA256 校验和。

这对本项目很有价值。用户只用 Windows 和 Chrome，因此本项目 Gateway 后续应优先提供：

```text
chatgpt-local-agent-gateway-win-x64.exe
start-gateway.bat
SHA256SUMS.txt
```

### 11.2 本项目分发建议

短期开发阶段：

```text
pnpm dev:gateway
```

中期可执行文件阶段：

```text
Gateway executable
+ Chrome Extension
+ First-run setup page
+ health check
```

不要强迫普通用户安装 Python/Node 环境。对于开发者版本可以保留源码运行方式。

### 11.3 控制台与日志

`mcp_bridge_server` 不推荐无控制台版本，因为需要显示运行日志。本项目也应保留可见日志，但正式产品可以提供两种模式：

```text
Developer mode: console + verbose logs
Normal mode: tray / background + log file + diagnostics UI
```

早期优先 console 版本，降低调试成本。

---

## 12. 安全模型分析

### 12.1 已有安全点

`mcp_bridge_server` 已具备一些基础保护：

- 配置中可 disabled server。
- 初始化和调用有 timeout。
- 工具连续失败 3 次后拒绝继续调用。
- 大结果缓存避免把长结果直接塞给前端。
- 端口占用时显示进程信息，不是静默失败。
- 配置文件存放在用户目录。
- 工具执行错误返回详细信息，便于诊断。

这些是可用性和稳定性层面的保护。

### 12.2 主要安全问题

从本项目的安全优先定位看，它的问题主要是：

1. **监听地址过宽**：`0.0.0.0` 不适合作为默认本地开发工具监听地址。
2. **CORS 过宽**：`allow_origins=["*"]` 使任意网页都可能请求本地服务。
3. **外部工具缺少细粒度 policy**：server enabled 后，工具层面没有 model visibility / execution policy。
4. **配置更新缺少二次确认**：`POST /config` 可直接覆盖配置并重载。
5. **环境变量继承过宽**：stdio server 默认继承主进程环境变量。
6. **错误 traceback 可能泄露敏感路径**：直接回传完整 Python traceback 给浏览器端。
7. **自动 kill 进程风险**：`--auto-kill-port` 可能误杀非本项目进程。
8. **缺少 audit log**：有控制台日志，但不是结构化、可查询、可导出的审计记录。
9. **缺少 workspace policy**：它代理的外部 filesystem server 自己处理路径，本 Gateway 没有统一约束。
10. **工具同名冲突处理不严格**：不指定 serverName 时使用第一个匹配工具，容易误调。

### 12.3 本项目应采用的安全默认

```text
host = 127.0.0.1
CORS allowlist = extension origin + localhost dev UI
external servers default disabled
external tools default hidden from model
tool execution default ask_every_time
write tools proposal_only
shell/system tools disabled
config update requires schema validation + diff preview
traceback redacted before UI/model display
env does not fully inherit by default
audit log always on
```

---

## 13. 与 mcp-bridge 的关系

这两个仓库是前后端配套关系：

| 方向 | mcp-bridge | mcp_bridge_server |
|---|---|---|
| 运行位置 | Chrome Extension | 本地 Python 服务 |
| 主要职责 | 站点适配、请求注入、响应解析、状态面板、Options | MCP server 管理、工具调用、缓存、配置、服务生命周期 |
| 通信方式 | 调用 localhost REST | 暴露 HTTP REST API |
| 核心配置 | `api_list.json` | `mcp-config.json` |
| 参考价值 | Browser Layer / Extension 架构 | Gateway / External MCP Adapter 架构 |

本项目应该把两者拆开吸收：

```text
mcp-bridge → Chrome Extension、Site Adapter、Fallback、UI Panel、Options
mcp_bridge_server → Local Gateway、External MCP、Result Cache、Server Lifecycle、Packaging
```

之前如果只分析 `mcp-bridge` 而没有单独分析 `mcp_bridge_server`，确实会漏掉 Gateway 侧的重要经验。

---

## 14. 与本项目当前 Gateway 的对照

### 14.1 mcp_bridge_server 强于本项目当前阶段的地方

| 方向 | mcp_bridge_server | 本项目应吸收 |
|---|---|---|
| 外部 MCP server | 已支持 stdio / sse | v0.3 外部 MCP adapter |
| 服务发现 | 两阶段 services/tools | 分层 tool catalog |
| 生命周期 | reload / restart-server / shutdown-server | Options 外部服务管理 |
| 大结果缓存 | 内存/文件缓存 + 搜索 + 上下文 | v0.8 result cache |
| 端口管理 | 启动前检测和交互处理 | Windows 启动体验 |
| 打包分发 | PyInstaller 单文件 | Gateway 可执行文件 |
| 错误诊断 | error type + traceback | diagnostics，但需脱敏 |
| 配置路径 | 用户目录标准路径 | `%APPDATA%` 配置目录 |

### 14.2 本项目应比它更强的地方

| 方向 | mcp_bridge_server 不足 | 本项目策略 |
|---|---|---|
| 安全默认 | 0.0.0.0 + CORS * | 127.0.0.1 + allowlist |
| 工具权限 | server enabled 为主 | per-tool policy |
| 模型可见性 | 缺少 | modelVisibility hidden/visible |
| 写入安全 | 取决于外部 MCP server | proposal + confirm |
| 命令安全 | 取决于外部 MCP server | run_task 白名单 |
| 审计 | 控制台日志 | audit log 持久化 |
| 配置安全 | 直接 POST /config | schema + diff + confirm |
| secret | env 直接展示/存储 | secret redaction |
| 同名工具 | 第一个匹配 | 强 namespace |

---

## 15. 可转化为本项目 PRD 的需求条目

### 15.1 External MCP Server Manager

```text
Gateway 必须支持 external MCP server 管理，但外部 server 默认 disabled。
每个 server 至少包含：name、type、command/url、args、env、description、enabled、status、timeout、defaultExecutionPolicy。
```

### 15.2 Two-level Tool Discovery

```text
当外部 MCP server 数量较多时，模型侧 catalog 不应一次性暴露所有外部工具。
系统应支持两阶段发现：先暴露已启用 server/service 摘要，再按需列出该 server 中允许模型可见的工具。
```

### 15.3 Namespaced Tool Identity

```text
所有工具必须使用稳定命名空间，避免同名工具冲突。
示例：builtin.read_file、external.filesystem.read_file、external.git.git_status。
未命名空间化的外部工具不得进入自动执行链路。
```

### 15.4 Service Lifecycle APIs

```text
Gateway 应提供单个 external MCP server 的 start / stop / restart / refresh-tools 能力，不要求每次修改配置都全量重启。
每次服务生命周期操作必须记录 event log。
```

### 15.5 Result Cache

```text
工具结果超过阈值时不得直接回填完整内容，必须返回 result cache reference。
Gateway 必须支持 get_result_page、search_result、get_context_lines 三类后续读取能力。
```

### 15.6 Port Management

```text
Gateway 启动时必须检测默认端口占用并给出清晰错误信息。
自动结束占用进程只能作为显式开发选项，不得默认启用。
```

### 15.7 Local-only Binding

```text
Gateway 默认只监听 127.0.0.1。任何局域网监听能力必须作为高级选项，并给出风险提示。
```

### 15.8 Config Safety

```text
Gateway 配置更新必须经过 schema validation。Options Page 保存外部 MCP 配置前必须展示 diff，并对 env / token / secret 字段脱敏。
```

### 15.9 Error Redaction

```text
工具执行错误可以保留 traceback 供 diagnostics 使用，但默认展示给模型和 UI 的错误必须脱敏，避免泄露本地绝对路径、用户名、token 或环境变量。
```

---

## 16. 建议写入架构文档的 Gateway 模块划分

```text
apps/gateway
  - HTTP API
  - GatewayConfigStore
  - BuiltinToolRegistry
  - ExternalMcpServerManager
  - ToolNamespaceResolver
  - PolicyEngine
  - ExecutionEngine
  - ResultCache
  - AuditLog
  - DiagnosticsService
  - PortManager
```

### 16.1 ExternalMcpServerManager

职责：

```text
- load server configs
- start stdio server
- connect SSE / HTTP server
- initialize MCP session
- list tools
- restart / shutdown server
- maintain status and lastError
```

### 16.2 ResultCache

职责：

```text
- decide inline vs cached_reference
- memory cache with LRU
- file cache for large results
- TTL cleanup
- paged read
- keyword search
- context lines
```

### 16.3 PolicyEngine

职责：

```text
- check modelVisibility
- check enabled
- check risk
- decide auto / ask / proposal / deny
- enforce namespace
- prevent duplicate execution
```

### 16.4 AuditLog

职责：

```text
- record server lifecycle events
- record config changes
- record tool calls
- record policy decisions
- record cache references
- redact sensitive fields
```

---

## 17. 推荐实施路线

### 17.1 近期可吸收

1. Gateway health 返回更完整诊断。
2. 明确 Gateway 默认只监听 `127.0.0.1`。
3. 增加端口占用检测和清晰错误提示。
4. 为大结果设计 `cached_reference` contract。
5. 增加 result cache 的 `get_result_page / search_result / get_context_lines` 设计文档。
6. 在 vNext 中明确 external MCP server 默认 disabled / hidden。
7. 文档中补充 `%APPDATA%` 配置路径策略。

### 17.2 v0.3 External MCP Adapter 可吸收

1. stdio MCP server initialize。
2. stdio MCP tools/list。
3. stdio MCP tools/call。
4. serverName namespace。
5. external server status。
6. server restart / shutdown。
7. env redaction。
8. server/tool policy。

### 17.3 v0.8 Result Cache 可吸收

1. 结果超阈值缓存。
2. 内存 / 文件两级缓存。
3. TTL 与 LRU。
4. 分页读取。
5. 搜索缓存。
6. 获取行上下文。
7. UI 中显示 resultId 与过期时间。

### 17.4 Windows 分发阶段可吸收

1. PyInstaller 或等价打包。
2. 控制台版本优先。
3. `start-gateway.bat`。
4. Release 文件命名。
5. SHA256 校验和。
6. 配置目录和日志目录标准化。
7. 端口冲突友好提示。

---

## 18. 不建议采纳点

### 18.1 不建议默认监听 0.0.0.0

本项目是本地开发工具，默认只需要 ChatGPT Web 和本机扩展访问。监听 `0.0.0.0` 会扩大局域网攻击面。

### 18.2 不建议 CORS 全开

`allow_origins=["*"]` 对本地工具服务过宽。正式版本应使用 allowlist，并考虑本地 token / origin check。

### 18.3 不建议自动选择同名工具

多个外部 MCP server 可能都有 `read_file`、`search`、`write_file`。不能因为兼容旧版本而自动选择第一个匹配。模型侧必须看到命名空间化工具名。

### 18.4 不建议默认继承全部环境变量

外部 MCP server 不应默认拿到主进程的所有 env。敏感环境变量应默认不传，或至少需要显式 `inheritEnv`。

### 18.5 不建议把 traceback 原样回填给模型

traceback 对开发者诊断有用，但直接给模型可能泄露本地路径、用户名和内部结构。应分成：

```text
model-safe error summary
user-visible detailed diagnostics
redacted raw traceback
```

### 18.6 不建议默认自动结束端口占用进程

端口管理很有用，但自动 kill 必须显式启用，并最好只针对已验证是本项目旧进程的 PID。

---

## 19. 对 docs/prd_vnext.md 的落地建议

当前 `docs/prd_vnext.md` 已经把 `mcp-bridge`、`MCP-SuperAssistant`、`mcp-link` 等作为参考项目写入，但应把 `mcp_bridge_server` 单独作为第五个参考项落地，而不是只混在 `mcp-bridge` 里。

建议新增一个小节：

```text
### 3.5 mcp_bridge_server

mcp_bridge_server 是 mcp-bridge 的本地 FastAPI MCP proxy，重点参考 Local Gateway、外部 MCP server lifecycle、两阶段工具发现、result cache、端口管理和 Windows 打包分发。
```

并在能力矩阵中将：

```text
外部 MCP server
大结果缓存
服务生命周期
端口管理
本地可执行文件分发
```

作为独立能力来源标注。

vNext 路线中也建议补充：

```text
v0.3 External MCP Adapter：参考 mcp_bridge_server 的 stdio initialize / tools/list / tools/call / restart-server / shutdown-server。
v0.8 Result Cache：参考 mcp_bridge_server 的 cached_reference / result page / search-cache / get-cache-context。
Windows 分发：参考 mcp_bridge_server 的 PyInstaller 和 start.bat。
```

---

## 20. 五个参考仓库在 docs 中的对应关系

当前应形成五份逐仓库分析文件：

| 仓库 | 对应 docs 文件 | 主要参考方向 |
|---|---|---|
| `tmp/reference/DeepseekWeb-enhance` | `docs/reference-deepseekweb-enhance-analysis.md` | userscript 原型、DeepSeek 会话增强、本地 MCP bridge、快速闭环 |
| `tmp/reference/mcp-bridge` | `docs/reference-mcp-bridge-analysis.md` | Chrome Extension、站点 adapter、fallback、状态面板、Options、输入注入 |
| `tmp/reference/mcp_bridge_server` | `docs/reference-mcp-bridge-server-analysis.md` | Local Gateway、外部 MCP server、REST API、result cache、端口管理、打包 |
| `tmp/reference/mcp-link` | `docs/reference-mcp-link-analysis.md` | tool visibility、approval、审计、安全叙事、Native Messaging、生态设计 |
| `tmp/reference/MCP-SuperAssistant` | `docs/reference-mcp-superassistant-analysis.md` | MV3 + Vite + TS、transport plugin、adapter registry、tool renderer、Side Panel |

这样才算真正做到“逐个仓库分析”。

---

## 21. 结论

`mcp_bridge_server` 补齐的是前面几份分析中最容易被低估的一层：**本地 Gateway 的产品化能力**。

它证明一个成熟的 Web AI MCP bridge 不能只有浏览器脚本，还需要一个足够稳定的本地服务层：

```text
外部 MCP server 配置
+ stdio/SSE 连接
+ 两阶段工具发现
+ 工具执行
+ 大结果缓存
+ 单服务重启/关闭
+ 端口管理
+ 打包分发
+ 错误诊断
```

本项目应吸收这些工程经验，但必须用更安全的默认策略重构：

1. 默认只监听 `127.0.0.1`。
2. CORS 不全开。
3. 外部 server 默认 disabled。
4. 外部 tool 默认 hidden。
5. 工具必须命名空间化。
6. 写入走 proposal。
7. 命令走 run_task 白名单。
8. 配置更新要 schema + diff + confirm。
9. 错误和 env 要脱敏。
10. 所有工具调用和服务生命周期操作进入 audit log。

综合五个参考仓库后，本项目的分层参考关系可以更清晰：

```text
DeepseekWeb-enhance：P0 userscript + 快速本地桥验证
mcp-bridge：P2 Chrome Extension + fallback + UI/Options
mcp_bridge_server：P1/P3 Local Gateway + External MCP + Cache + Packaging
MCP-SuperAssistant：P2/P3 MV3 工程化 + transport plugin + renderer
mcp-link：P3/P4 权限、安全、审计、生态叙事
```

这份文件用于补齐第五个仓库的独立分析，后续应同步更新 `docs/prd_vnext.md`，让路线图明确体现五个仓库分别贡献的能力边界。
