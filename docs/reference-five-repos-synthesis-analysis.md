# 五个参考仓库综合分析：对 ChatGPT Web Local Agent Bridge 的产品与 PRD 启发

## 0. 文档信息

- 产品项目：ChatGPT Web Local Agent Bridge
- 输出文件：`docs/reference-five-repos-synthesis-analysis.md`
- 分析对象：
  - `docs/reference-deepseekweb-enhance-analysis.md`
  - `docs/reference-mcp-bridge-analysis.md`
  - `docs/reference-mcp-bridge-server-analysis.md`
  - `docs/reference-mcp-link-analysis.md`
  - `docs/reference-mcp-superassistant-analysis.md`
  - `docs/prd_vnext.md`
- 目标用途：为产品开发、架构路线和 `docs/prd_vnext.md` 后续修订提供综合判断。
- 分析方式：不逐仓库机械复述，重点做跨仓库综合、归纳、对比、取舍和产品化落地。

---

## 1. 总体结论

这五个参考仓库分别代表了五条不同路线，不应简单理解为同类竞品。

| 仓库 | 代表路线 | 对本项目的核心启发 |
|---|---|---|
| DeepseekWeb-enhance | userscript 快速增强 + 本地工具桥 + 会话管理 | 证明 userscript + localhost gateway 可以快速跑通，也证明会话增强和本地工具桥天然相关 |
| mcp-bridge | Chrome Extension + 多站点 adapter + fallback + 状态面板 | 证明 Web AI bridge 真正可用需要 adapter、fallback、面板、Options、诊断和缓存 |
| mcp_bridge_server | 独立 Local Gateway + 外部 MCP proxy + result cache + 生命周期管理 | 证明浏览器层之外必须有一个产品化本地服务层 |
| mcp-link | 工具可见性、审批、安全叙事、审计、生态化 | 证明“AI 可调用工具”必须被包装成用户可控、可审计的权限系统 |
| MCP-SuperAssistant | MV3 工程化 + transport abstraction + adapter registry + tool renderer | 证明中期要从脚本演进到工程化扩展，但早期不应被多平台路线拖重 |

五个仓库共同证明了一件事：**Web AI 调本地工具的需求是成立的，但真实产品门槛不在“能不能调工具”，而在“能不能稳定、安全、可恢复、可诊断地调工具”。**

本项目最应该吸收的是：

1. 本地 Gateway 独立产品化，而不是只做一个临时 localhost server。
2. 工具调用链路必须有 fallback、去重、状态机和诊断。
3. 工具权限必须拆成可见性、启用状态、执行策略、风险等级、审批方式。
4. 大结果必须缓存化、分页化，不能直接塞回 ChatGPT 输入框。
5. Chrome Extension 是中期方向，但近期不要过重。
6. 写入和命令执行必须 proposal / whitelist 化，不能追求强能力优先。

本项目最应该避免的是：

1. 过早多平台化，把资源消耗在十几个站点 DOM 维护上。
2. 直接开放任意 shell、直接写文件、外部 MCP 自动执行。
3. 做一个“小型 MCP-SuperAssistant”，失去 ChatGPT Web 深度和本地开发工作流差异化。
4. 做一个“ChatGPT 版 DS Enhance”，只复刻会话增强和工具桥，而没有安全、审计、proposal。
5. 做装饰性安全，比如写了签名、审批、审计，但实际没有真实约束和失败闭环。

当前 `docs/prd_vnext.md` 的总体方向是正确的：它已经明确了 ChatGPT Web 深度优先、Windows + Chrome 一等公民、默认安全、proposal 写入、run_task 白名单、外部 MCP 默认保守、诊断优先等核心原则。

但它还有一个明显缺口：**`mcp_bridge_server` 没有作为独立参考来源进入 PRD 的参考项目列表、能力矩阵和路线说明。**这会导致 Local Gateway、端口管理、外部 MCP 生命周期、result cache、Windows 打包分发这些服务端产品化能力被低估。

---

## 2. 五个仓库的角色定位

| 仓库 | 在本项目中的参考角色 | 应吸收 | 应避免 |
|---|---|---|---|
| DeepseekWeb-enhance | 快速 userscript + 本地工具桥 + 会话增强参考 | userscript 原型、SSE/响应检测、工具结果回填、本地 FastAPI bridge、shared panel UI、外部 MCP stdio adapter、preset 机制 | 直接照搬 DeepSeek 内部 API、读取 token、批量官方会话操作、直接 shell/write_file、`0.0.0.0 + CORS *` 默认暴露面 |
| mcp-bridge | Chrome Extension 分层、站点适配、fallback、状态面板、缓存参考 | Page World / Content Script / Background 分层、api_list adapter、四层 fallback、状态面板、Options、result cache | 早期追求多平台、外部工具偏自动执行、配置灵活性压过安全 schema |
| mcp_bridge_server | Local Gateway、stdio/SSE MCP proxy、服务生命周期、端口与打包参考 | 外部 MCP server 管理、tools 两阶段发现、result cache、server restart/stop、端口检测、Windows 分发 | 默认 `0.0.0.0`、CORS 全开、auto-kill-port 默认启用、traceback 原样回传、env 全继承 |
| mcp-link | tool visibility、approval、audit、安全叙事和生态路线参考 | 工具可见性、运行时审批、透明审计、高风险确认、settings schema、recipe 思路 | `<all_urls>`、debugger/cookies/history 等全权限、过早 store/monetization/mobile/IoT、半成品签名叙事 |
| MCP-SuperAssistant | MV3 工程、transport abstraction、adapter registry、tool call renderer 参考 | Vite + TS + MV3、MCP transport plugin、SiteAdapterRegistry、streaming-aware parser/renderer、ToolCallCard、duplicate guard | 早期多站点、remote config/analytics、全局 autoExecute、复杂 editor extraction 过早进入 P0 |

一句话概括：

> DeepseekWeb-enhance 用来证明 P0 跑得通；mcp-bridge 用来设计浏览器层可靠性；mcp_bridge_server 用来设计 Gateway；mcp-link 用来设计安全和权限；MCP-SuperAssistant 用来设计中期扩展工程化。

---

## 3. 跨仓库共识能力

### 3.1 共识能力矩阵

| 能力 | 为什么重要 | 哪些仓库体现 | 本项目应如何吸收 | 推荐阶段 |
|---|---|---|---|---|
| 本地 gateway / bridge server | Web 页面不能直接安全访问本地文件、stdio MCP、命令和缓存；必须有本地服务层 | DeepseekWeb-enhance、mcp-bridge、mcp_bridge_server、MCP-SuperAssistant | Gateway 要成为一等模块：health、tool registry、policy、audit、proposal、result cache、external MCP manager | v0.1.1 起固化，v0.3 加强 |
| 工具发现与工具调用 | bridge 的基本闭环；同时决定 prompt 体积和模型可见范围 | 全部 | 区分 model catalog、UI tool list、raw MCP tools；工具必须 namespace 化 | v0.1.1 / v0.2 |
| 外部 MCP server 接入 | 竞品都有；不做会显得落后，但安全风险高 | DeepseekWeb-enhance、mcp-bridge、mcp_bridge_server、MCP-SuperAssistant、mcp-link | v0.2 做 Spike，v0.3 做 stdio P0；默认 disabled / hidden / ask_every_time | Spike v0.2，P0 v0.3 |
| 站点 adapter / recipe | Web AI 页面变化频繁，不能把 ChatGPT DOM/API 路径写散 | mcp-bridge、mcp-link、MCP-SuperAssistant | 内部先抽 ChatGPT adapter；分 network / DOM / interaction / diagnostics | v0.2 开始，v0.7 扩展化 |
| request-layer injection 与 DOM fallback | 单一路径会失败；请求结构和页面 DOM 都可能变化 | mcp-bridge、DeepseekWeb-enhance | request-layer 是主路径；DOM redetect、manual paste 是兜底；所有来源归一为 NormalizedToolCallBatch | v0.2 |
| tool call parser / renderer | streaming、partial JSON、重复渲染都会导致误触发 | MCP-SuperAssistant、mcp-bridge、DeepseekWeb-enhance | parser 独立可测；renderer 只负责展示；加 duplicate guard | v0.2 |
| panel / side panel / status UI | 用户需要知道发生了什么、卡在哪一步、怎么恢复 | DeepseekWeb-enhance、mcp-bridge、MCP-SuperAssistant、mcp-link | userscript 阶段做 panel-side cards；Extension 阶段升级 Side Panel | v0.2 / v0.7 |
| result cache / 分段读取 | grep、read_file、run_task 输出很容易过大 | mcp-bridge、mcp_bridge_server | 不应等到 v0.8 才有基础 contract；先做轻量 cache reference，后做完整 UI | contract v0.3，完整 v0.8 |
| 权限控制与运行时确认 | 工具能力越强，越需要用户控制 | mcp-link、MCP-SuperAssistant、prd_vnext 已吸收 | modelVisibility / enabled / risk / executionPolicy / confirmationRequired 分离 | v0.2 |
| 审计日志与诊断 | 本地开发工具必须可追踪、可复盘、可复制 issue 信息 | mcp-link、mcp-bridge、mcp_bridge_server、DeepseekWeb-enhance | 每次 tool call、policy decision、proposal apply、server lifecycle 都入 audit | v0.2 起 |
| 配置页 / 用户文档 / 排障路径 | 这类工具失败点多，文档本身是产品体验 | mcp-bridge、mcp_bridge_server、mcp-link | `docs/security.md`、`docs/troubleshooting.md`、`docs/diagnostics.md` 必须先补 | v0.1.1 |

核心判断：**v0.2 不应该只是 UI 增强，而应该是“可控工具调用系统”的开始：parser、policy、card、diagnostics、fallback、audit 都应该在这一阶段建立骨架。**

### 3.2 DeepseekWeb-enhance 带来的特殊启发

DeepseekWeb-enhance 的价值不只是“一个 userscript 项目”，而是它证明了一个早期产品事实：**会话管理增强和本地工具调用会自然走到一起。**

它的 DS Enhance 侧提供批量删除、Fork、分类、搜索、导出、批量重命名、快捷键等能力；DS MCP Bridge 侧提供 SSE 拦截、工具调用检测、自动注入结果、本地 FastAPI server、shell / 文件 / 搜索 / 网页抓取、外部 MCP server 和控制面板。

对本项目而言，真正该吸收的是：

1. userscript 阶段用 panel-side UI 快速承载状态和操作。
2. 本地 Gateway 的 `/health` 不能只是 `ok`，要返回工具数量、外部 server 状态、workspace 等诊断信息。
3. 外部 MCP stdio adapter 应该早做 Spike。
4. Preset 机制可以作为未来外部 MCP server 配置模板，但安装后必须默认 disabled / hidden。
5. shell、write_file、外部 MCP 自动合并这些强能力必须经过更严格的产品级权限治理。

尤其要警惕两个默认值：

```text
host = 0.0.0.0
CORS allow_origins = *
```

这类配置叠加强工具会明显扩大暴露面。本项目应明确默认只监听 `127.0.0.1`，并将 CORS / origin / trusted local token 作为 Gateway 安全基线。

---

## 4. 本项目的差异化判断

本项目不应该变成“小型 MCP-SuperAssistant”，因为那条路线的核心是多平台、多 transport、多站点 adapter。对一个早期项目来说，这会快速吞掉工程精力。

也不应该变成“ChatGPT 版 DS Enhance”，因为 DS Enhance 的价值是 DeepSeek 页面增强 + 本地工具桥，而本项目真正的机会在于把 ChatGPT Web 变成本地开发工作流入口。

本项目应该坚持以下差异化。

### 4.1 ChatGPT Web 深度优先

不要早期支持 Claude、Gemini、DeepSeek、Kimi、Qwen。应该把 ChatGPT 的这些链路做深：

- live catalog injection
- fenced `mcp` JSON block parser
- streaming / complete / DOM / manual fallback
- send button / input injection
- result insertion / auto send
- tool card / proposal card
- diagnostics package

多站点 adapter 可以在架构上预留，但不应该成为近期产品承诺。

### 4.2 Windows + Chrome 一等公民

`prd_vnext.md` 已经写了 Windows + Chrome，这是正确的。建议进一步落地到：

- 默认 gateway：`http://127.0.0.1:8024`
- `%APPDATA%` 配置、日志、cache 目录
- `start-gateway.bat`
- 端口占用检测
- Windows 防火墙 / 端口 / PowerShell 排障文档
- Chrome Extension host permissions 只给 `chatgpt.com` + `127.0.0.1`

### 4.3 默认安全，而不是默认强能力

本项目的可信度来自克制：

- read/list/grep 可以低风险自动执行
- write 必须 proposal
- apply 必须确认
- command 必须 run_task 白名单
- external MCP 默认 hidden / disabled / ask_every_time
- remote MCP 后置
- browser automation 后置
- nativeMessaging 后置

这比“能调用更多工具”更重要。

### 4.4 本地开发工作流闭环

真正应该追求的是：

```text
读仓库
→ 搜索上下文
→ 审查问题
→ 生成修改 proposal
→ 用户看 diff
→ apply
→ run_task test/lint/build
→ 回读结果
→ 记录 audit
```

这条闭环比“支持 20 个 MCP server”更有产品价值。

### 4.5 写入 proposal 化

`prd_vnext.md` 的 v0.4 方向正确，但建议把“临时 write_file 回收”写得更硬：

- v0.4 后 `write_file` 默认关闭
- 不进入 model catalog
- 仅 development escape hatch
- 正式文档不再教模型直接调用 `write_file`
- 所有写入示例改为 `write_file_proposal` + `apply_proposal`

### 4.6 run_task 白名单替代任意 shell

`run_pwsh` 作为 disabled placeholder 是正确的。正式路线应该是：

```text
run_task lint
run_task test
run_task build
run_task git-status
run_task git-diff-stat
```

不要开放自由命令字符串给模型，即使有 dangerous pattern blocking 也不够。

### 4.7 诊断、审计和用户可恢复性作为核心体验

这个项目不是“代码能跑就行”。失败点太多：

- Gateway 没启动
- catalog 没注入
- ChatGPT 没输出 mcp block
- userscript 没检测到
- 工具 schema 不合法
- 权限被拒绝
- 工具执行失败
- 结果太大
- 插入失败
- 自动发送失败

所以必须让用户知道：**失败在哪一层、为什么失败、下一步能做什么。**

---

## 5. 对 `docs/prd_vnext.md` 的复核

### 5.1 已经吸收得比较好的部分

`docs/prd_vnext.md` 已经很好地吸收了这些关键方向：

1. **定位正确**：已经从 “ChatGPT Web MCP Bridge” 升级为 “安全优先本地开发工作流增强器”。
2. **差异化明确**：已经明确不做“小型 MCP-SuperAssistant”或“ChatGPT 版 DS Enhance”。
3. **安全原则比较完整**：已经写入只读优先、写入 proposal、shell 不作为主产品能力、run_task 白名单、外部 MCP 默认保守。
4. **工具权限字段已有雏形**：已经定义 `modelVisibility`、`uiVisibility`、`enabled`、`risk`、`executionPolicy`、`confirmationRequired`。
5. **fallback 状态机已经开始成型**：已经有 request hook、catalog injection、stream observed、DOM detection、startup rescan、manual paste 等状态。
6. **文档路径意识很好**：v0.1.1 要补 `acceptance.md`、`security.md`、`troubleshooting.md`，这是非常正确的。
7. **版本路线整体合理**：v0.1.1 文档固化，v0.2 权限和 panel，v0.3 外部 MCP，v0.4 proposal，v0.5 run_task，v0.7 Extension，方向基本对。

### 5.2 仍然缺失或不够明确的部分

#### 缺口 1：`mcp_bridge_server` 没有作为独立参考来源写入

PRD 的参考项目列表目前只有：

- DeepseekWeb-enhance
- mcp-bridge
- mcp-link
- MCP-SuperAssistant

但实际上 `mcp_bridge_server` 是第五个关键参考，而且它不是 `mcp-bridge` 的附属小点，而是 **Gateway 侧的主参考**。

这会影响：

- Local Gateway API contract
- external MCP server lifecycle
- result cache
- port management
- Windows packaging
- config path
- service restart / stop
- stdio / SSE proxy
- two-level tools discovery

建议必须补。

#### 缺口 2：Local Gateway 还不够产品化

PRD 已写 Gateway 责任，但还偏“模块列表”。需要补成明确 contract：

- `/health` 返回什么
- `/catalog` 返回什么
- `/execute` 如何命名空间化
- `/diagnostics` 返回什么
- `/servers/{name}/status`
- `/servers/{name}/start|stop|restart|refresh-tools`
- result cache API
- audit log API
- config read/write 的 schema、diff、redaction

#### 缺口 3：result cache 放到 v0.8 太晚

完整 UI 和清理机制放 v0.8 可以，但基础 result cache contract 不宜等到 v0.8。

原因：

- v0.3 外部 MCP 可能返回大结果
- v0.5 run_task 会返回大 stdout/stderr
- grep/read_file 本身就可能超长
- ChatGPT 输入框不适合塞大输出

建议拆成：

```text
v0.2/v0.3：轻量 cached_reference contract + 截断摘要
v0.5：run_task 输出接入 cache
v0.8：完整 cache UI、搜索、分页、清理
```

#### 缺口 4：Tool Policy 还需要更可执行

现在字段有了，但还需要补：

- policy decision 流程
- 默认策略表
- 外部 MCP tool 默认值
- write/apply/run_task 的策略
- namespace 强制规则
- duplicate guard 是否在 policy 前后
- “modelVisibility hidden 但手动 UI 可执行”的语义
- tool catalog cache 失效条件

#### 缺口 5：Chrome Extension 阶段可能过重

v0.7 的 Options Page 必备能力太多：

- Gateway URL
- health
- automation toggles
- tool policy
- site adapter
- MCP servers
- audit log
- result cache
- diagnostics

这些都对，但如果全部作为 v0.7 必备，会导致迁移阶段变重。建议 v0.7 拆成：

```text
v0.7a：MV3 shell + 原 userscript 能力迁移 + Popup health + basic Side Panel
v0.7b：Options tool policy + audit log + external MCP UI
v0.7c：result cache UI + advanced adapter diagnostics
```

或者保留 v0.7 一个版本，但在 PRD 中区分 P0/P1。

#### 缺口 6：Diagnostics / Troubleshooting / Acceptance 需要产品化，不只是文档化

PRD 已经说要写文档，但应该进一步定义：

- Copy diagnostics 的字段 schema
- 用户看到的错误恢复路径
- 每个失败状态对应的 UI action
- acceptance 测试按链路分层：Gateway / Parser / Policy / Injection / Insertion / Tool execution / Fallback

#### 缺口 7：仍有“直接写文件”残留风险需要更硬约束

PRD 已经说明临时 `write_file` 是自举能力，但当前本地工具列表中 `write_file` 仍可能处于 enabled 状态。文档里应该更明确：

- 当前 enabled 只用于开发阶段
- 不应进入公开默认配置
- 不应出现在模型默认 catalog
- v0.4 必须回收
- 任何示例都不应鼓励直接 replace 文件

#### 缺口 8：DeepseekWeb-enhance 的本地服务风险没有充分沉淀到 PRD

DeepseekWeb-enhance 分析中已经明确：其服务端存在 `0.0.0.0 + CORS *` 的默认暴露面风险，并且工具层包含 `execute_command`、`write_file`、外部 MCP 自动合并等强能力。

PRD 目前已经写了 `127.0.0.1 only`，但还应补充：

- CORS allowlist
- trusted local token / local access token
- external vs builtin 工具名冲突避免
- stderr diagnostics
- preset 安装后的默认 disabled/hidden
- host binding 作为 acceptance/security 测试项

---

## 6. 推荐写入 `docs/prd_vnext.md` 的修改建议

### 6.1 必须补充

#### 建议 1：新增 `3.5 mcp_bridge_server`

- 位置：第 3 节竞品与参考项目分析，放在 mcp-bridge 后面或作为独立 3.3。
- 问题：当前 PRD 没把第五个仓库作为独立参考来源。
- 修改方向：写明它是 Local Gateway / External MCP / Result Cache / Port Management / Packaging 的核心参考。
- 版本阶段：立即，v0.1.1 文档修订。

建议内容：

```md
### 3.5 mcp_bridge_server

mcp_bridge_server 是 mcp-bridge 浏览器扩展对应的本地 FastAPI MCP proxy。它的参考价值主要在 Gateway 侧，而不是浏览器侧：外部 MCP server 配置、stdio/SSE 连接、两阶段工具发现、工具执行、result cache、服务重启/关闭、端口管理和 Windows 打包分发。

本项目应吸收其 Local Gateway 产品化经验，但必须采用更保守的安全默认：仅监听 127.0.0.1、CORS allowlist、外部 server 默认 disabled、外部工具默认 hidden、工具强 namespace、配置更新 schema validation + diff preview、错误与 env 脱敏、服务生命周期进入 audit log。
```

#### 建议 2：更新第 3 节参考项目列表和第 4 节能力矩阵

- 位置：第 3 节开头、第 4 节能力矩阵。
- 问题：能力矩阵缺少 mcp_bridge_server，导致 Gateway 能力来源不清。
- 修改方向：新增一列 `mcp_bridge_server`，或者单独新增“服务端能力矩阵”。
- 版本阶段：v0.1.1。

应新增能力行：

- Local Gateway
- stdio MCP proxy
- SSE MCP proxy
- two-level tool discovery
- service restart/stop
- result cache
- port management
- Windows packaging
- config path / config update

#### 建议 3：补 Gateway API Contract 小节

- 位置：第 6 节目标架构后，新增 `6.4 Gateway API Contract`。
- 问题：目前 Gateway 只是责任列表，缺少可实现契约。
- 修改方向：定义 health、catalog、execute、diagnostics、audit、result cache、external server lifecycle。
- 版本阶段：v0.2 / v0.3 前必须补。

建议写入：

```text
Gateway API 至少包含：
- GET /health
- GET /catalog
- POST /execute
- GET /diagnostics
- GET /audit
- GET /results/{resultId}
- POST /results/{resultId}/search
- POST /results/{resultId}/context
- GET /servers
- POST /servers/{serverName}/start
- POST /servers/{serverName}/stop
- POST /servers/{serverName}/restart
- POST /servers/{serverName}/refresh-tools
```

#### 建议 4：提前 result cache contract

- 位置：第 5.7 或 v0.3 / v0.5 章节中补；v0.8 保留完整版本。
- 问题：v0.8 才做 result cache 太晚。
- 修改方向：拆成“轻量 contract 先行，完整 UI 后置”。
- 版本阶段：v0.3 基础，v0.8 完整。

建议写入：

```text
从 v0.3 开始，所有工具结果都必须经过统一 ToolResult envelope。超过阈值的结果不得直接回填完整内容，而应返回 cached_reference。v0.8 再补完整 UI、搜索、清理和持久化管理。
```

#### 建议 5：补 Tool Policy Decision 流程

- 位置：第 5.3 后新增。
- 问题：字段有了，但缺少决策流程。
- 修改方向：明确从 parse 到 validate 到 policy 到 execute 的顺序。
- 版本阶段：v0.2。

建议写入：

```text
ToolCallBatch
→ parse / normalize
→ schema validate
→ namespace resolve
→ duplicate guard
→ tool enabled check
→ modelVisibility consistency check
→ risk classification
→ executionPolicy decision
→ auto / ask / proposal / reject
→ execute or wait for user
→ audit record
→ result insertion
```

#### 建议 6：明确外部 MCP 默认策略

- 位置：v0.3 外部 MCP Adapter。
- 问题：已有默认 disabled，但还应更明确。
- 修改方向：写死默认策略。
- 版本阶段：v0.3。

建议默认值：

```json
{
  "enabled": false,
  "modelVisibility": "hidden",
  "uiVisibility": "visible",
  "executionPolicy": "ask_every_time",
  "confirmationRequired": true,
  "risk": "unknown",
  "audit": true
}
```

#### 建议 7：补端口管理和 Windows 分发

- 位置：Gateway 章节或新增 `Windows-first Local Gateway` 小节。
- 问题：Windows + Chrome 写了，但没有足够落地。
- 修改方向：补 `%APPDATA%`、端口占用、start bat、日志、pid file。
- 版本阶段：v0.3 / v0.7 前。

建议写入：

```text
Gateway 默认配置目录：
%APPDATA%\chatgpt-web-local-agent-bridge\config

日志目录：
%APPDATA%\chatgpt-web-local-agent-bridge\logs

缓存目录：
%APPDATA%\chatgpt-web-local-agent-bridge\cache

默认不自动 kill 占用端口的进程。只有确认是本项目旧 Gateway 的 pid，才允许安全重启。
```

#### 建议 8：补 Local Gateway 安全基线

- 位置：第 5 产品原则或第 6 Gateway 责任。
- 问题：当前只写了 `127.0.0.1 only`，还不够完整。
- 修改方向：加入 CORS allowlist、local access token、origin check、host binding acceptance。
- 版本阶段：v0.1.1 / v0.2。

建议写入：

```text
Local Gateway 安全基线：
- 默认只监听 127.0.0.1。
- 默认不允许 0.0.0.0 / 局域网访问。
- CORS 必须使用 allowlist，不允许生产默认 allow_origins=*。
- 浏览器侧访问 Gateway 应带 local access token 或等价 trusted local 校验。
- health / diagnostics 不得泄露 secret、token、完整 env。
- host binding 与 CORS 策略必须进入 acceptance/security 测试。
```

#### 建议 9：补 external tool namespace 强制规则

- 位置：v0.3 外部 MCP Adapter。
- 问题：DeepseekWeb-enhance 和 mcp_bridge_server 都体现出外部工具名冲突风险。
- 修改方向：所有工具必须 namespace 化，未 namespace 的外部工具不得进入自动执行链路。
- 版本阶段：v0.3。

建议写入：

```text
所有工具必须使用稳定 namespace：
- builtin.read_file
- builtin.grep_files
- external.filesystem.read_file
- external.github.create_issue

外部 MCP tool 不得以裸工具名进入 model catalog。若外部工具与内置工具同名，必须保留两者并通过 namespace 区分，不允许覆盖。
```

### 6.2 建议补充

#### 建议 10：新增 Site Adapter 分层

- 位置：第 6.3 Site Adapter 责任。
- 问题：当前 adapter schema 偏单对象，容易变大。
- 修改方向：拆成 network / DOM / interaction / diagnostics。
- 版本阶段：v0.2 设计，v0.7 实现。

```text
SiteAdapter =
- NetworkAdapter: request hook, response parser, catalog injection
- DOMAdapter: input, submit button, assistant messages, redetect
- InteractionAdapter: insert text, submit, attach files
- DiagnosticsAdapter: collect current site state
```

#### 建议 11：新增 NormalizedToolCall / ToolResult schema

- 位置：v0.2。
- 问题：现在 batch schema 固化了，但 parser 和 renderer 的内部对象还不够明确。
- 修改方向：借鉴 MCP-SuperAssistant 的 parser/renderer 分离。
- 版本阶段：v0.2。

建议字段：

```json
{
  "callId": "...",
  "toolName": "builtin.read_file",
  "arguments": {},
  "sourceMessageId": "...",
  "sourceRange": null,
  "isComplete": true,
  "parseConfidence": "high",
  "rawText": "..."
}
```

#### 建议 12：新增 Duplicate Guard 规则

- 位置：第 5.6 fallback 状态机。
- 问题：现在写了 `messageId + normalizedJsonHash`，但建议补 attempt 概念。
- 修改方向：

```text
toolCallKey = hash(sourceMessageId + toolName + normalizedArguments)
attemptId = 每次实际执行生成的新 id
同一 toolCallKey 不得自动执行多次；用户手动 retry 生成新的 attemptId。
```

#### 建议 13：补配置安全

- 位置：v0.3 外部 MCP、v0.7 Options。
- 问题：外部 server 配置涉及 env、token、command、args。
- 修改方向：schema validation、secret redaction、diff preview、默认 disabled。
- 版本阶段：v0.3 / v0.7。

#### 建议 14：把 docs 从“文件列表”升级为“用户路径”

- 位置：第 8 节。
- 问题：已有必备文档列表，但还可补用户任务路径。
- 修改方向：每个文档对应一个用户问题，例如“为什么工具没执行”“为什么结果没插入”“如何确认安全”。
- 版本阶段：v0.1.1。

#### 建议 15：补 external MCP preset 作为本地模板，而不是 store

- 位置：v0.3 或 v0.7 Options。
- 问题：DeepseekWeb-enhance 的 `presets.json` 很实用，但直接发展成 marketplace 会过早。
- 修改方向：先做本地 preset 模板。
- 版本阶段：v0.3 P1 / v0.7 P1。

建议规则：

```text
Preset 安装后：
- server 默认 disabled
- tools 默认 hidden
- executionPolicy 默认 ask_every_time
- secret params 单独输入并脱敏保存
- 安装前展示风险说明和配置 diff
```

### 6.3 应该后移或删除

#### 建议 16：Chrome Extension 阶段不要一次性做完整 Options

- 位置：v0.7。
- 问题：当前 v0.7 P0 过重。
- 修改方向：拆 P0/P1。
- 版本阶段：v0.7。

v0.7 P0 建议只包含：

- MV3 shell
- Content Script + Page World Script 分层
- 原 userscript 能力迁移
- Popup health
- Basic Side Panel
- Copy diagnostics
- basic tool card

v0.7 P1 再做：

- full Options
- external MCP server UI
- audit query UI
- result cache UI
- advanced site adapter config

#### 建议 17：外部 HTTP/SSE MCP 不要和 stdio 同期作为 P0

- 位置：v0.3。
- 问题：HTTP/SSE 有远程安全风险。
- 修改方向：stdio P0，local SSE P1，remote HTTP/SSE 后置。
- 版本阶段：v0.3 / v0.8+。

#### 建议 18：会话管理中的 ChatGPT 内部 API 能力继续后移

- 位置：v0.6。
- 问题：读取 ChatGPT token/API 风险高。
- 修改方向：P0/P1 只做当前会话、本地索引、用户显式导出。
- 版本阶段：v0.6 P2 或更后。

#### 建议 19：Remote config、analytics、store、nativeMessaging、browser automation 不进 v0.x 主线

- 位置：长期路线。
- 问题：容易稀释本地可信开发工具定位。
- 修改方向：全部作为 post-v1 或实验能力。
- 版本阶段：后期。

---

## 7. 版本路线重排建议

当前路线整体是合理的，但建议做一些前移、拆分和降级。

| 版本 | 当前方向 | 判断 | 调整建议 |
|---|---|---|---|
| v0.1.1 | 文档口径、acceptance/security/troubleshooting | 合理 | 增加 mcp_bridge_server 参考补录；明确 write_file 自举边界；加入 host/CORS 安全基线 |
| v0.2 | Tool Card、权限、诊断、外部 MCP Spike | 合理 | 增加 parser/normalizer/duplicate guard；不要只做 UI |
| v0.3 | 最小外部 MCP Adapter | 合理 | 只把 stdio 作为 P0；补 server lifecycle、namespace、config redaction、lightweight result cache contract |
| v0.4 | 安全写入 Proposal | 合理且关键 | 建议不后移；这是产品差异化核心 |
| v0.5 | run_task 白名单 | 合理 | 需要提前接入轻量 result cache，否则 test/build 输出不好处理 |
| v0.6 | 会话管理增强 | 可做，但注意边界 | P0 只做当前会话导出、tool history、本地标签、workspace 绑定 |
| v0.7 | Chrome Extension 正式形态 | 方向合理，但范围偏重 | 拆 P0/P1，先迁移能力，再补完整 Options |
| v0.8 | 大结果缓存与分段读取 | 完整版本合理，但基础能力太晚 | 基础 contract 前移到 v0.3/v0.5；v0.8 做完整 UI 和持久化 |
| v0.9 | Sandbox / Docker 实验 | 合理后置 | 作为 Spike，不作为默认依赖 |

### 7.1 建议后的关键路径

更合理的产品闭环关键路径是：

```text
v0.1.1 文档与验收固化
→ v0.2 parser + policy + panel card + diagnostics
→ v0.3 stdio external MCP + lightweight result cache contract
→ v0.4 write proposal
→ v0.5 run_task + cache 接入
→ v0.6 当前会话 / 本地索引
→ v0.7 Chrome Extension 迁移
→ v0.8 完整 result cache UI
→ v0.9 sandbox spike
```

### 7.2 哪些应该前移

1. `mcp_bridge_server` 参考补录：立即。
2. Gateway API contract：v0.2 前。
3. Local Gateway 安全基线：v0.1.1 / v0.2。
4. NormalizedToolCall / ToolResult：v0.2。
5. Duplicate guard：v0.2。
6. 轻量 result cache contract：v0.3。
7. port management：v0.3。
8. config redaction：v0.3。
9. external tool namespace：v0.3。

### 7.3 哪些应该后移

1. 多站点 adapter。
2. remote MCP 自动执行。
3. Native Messaging。
4. Browser automation。
5. ChatGPT 内部 API 会话批量管理。
6. Remote config / analytics。
7. Store / plugin marketplace。
8. 完整 Docker sandbox 默认集成。

### 7.4 哪些应作为 Spike，而不是正式功能

1. 外部 MCP HTTP/SSE。
2. ChatGPT internal API 会话读取。
3. Native Messaging 自动发现。
4. Browser automation。
5. Docker sandbox。
6. CodeMirror / Monaco 深度 extraction。
7. 多站点 adapter。

---

## 8. 推荐新增到 PRD 的验收与测试重点

### 8.1 Gateway / Security Acceptance

| 用例 | 期望 |
|---|---|
| Gateway 默认 host | 只监听 `127.0.0.1` |
| CORS 默认策略 | 不允许生产默认 `allow_origins=*` |
| 局域网访问 | 默认不可访问 |
| health 输出 | 不泄露 secret、token、完整 env |
| workspace 越界 | 阻断 |
| sensitive path | 阻断 |
| write_file | 默认不进入正式 catalog |
| external tool same name | 不覆盖 builtin tool |

### 8.2 Parser / Fallback Acceptance

| 用例 | 期望 |
|---|---|
| fenced `mcp` JSON block | 可解析为 NormalizedToolCallBatch |
| streaming partial block | incomplete 不执行 |
| DOM redetect | 产出同一 NormalizedToolCallBatch |
| manual paste | 进入同一 policy/audit 链路 |
| 重复扫描同一消息 | 不重复自动执行 |
| retry | 生成新的 attemptId |

### 8.3 External MCP Acceptance

| 用例 | 期望 |
|---|---|
| stdio initialize | 成功建立 session |
| tools/list | 工具命名空间化 |
| tools/call | 经过 policy decision |
| stderr 输出 | 被单独收集到 diagnostics |
| server stop/restart | lifecycle 进入 audit log |
| env secret | UI 和 diagnostics 中脱敏 |
| preset install | 默认 disabled / hidden |

### 8.4 Result Cache Acceptance

| 用例 | 期望 |
|---|---|
| grep 大结果 | 返回 cached_reference |
| run_task 大 stdout | 不直接完整回填 |
| get_result_page | 可分页读取 |
| search_result | 可搜索缓存结果 |
| get_context_lines | 可取目标行上下文 |
| cache expired | 给出明确错误和恢复提示 |

---

## 9. 最终建议

近期最该做的不是继续加更多工具，而是把现有工具桥变成可信系统：

```text
parser 独立
policy engine 成型
tool card 可见
diagnostics 可复制
fallback 可恢复
audit 可追踪
文档可验收
```

中期最该做的是本地开发闭环：

```text
external stdio MCP
write proposal
apply confirmation
run_task whitelist
lightweight result cache
tool history
workspace 绑定
```

长期才考虑：

```text
多站点 adapter
remote MCP
Native Messaging
browser automation
sandbox
plugin/store ecosystem
```

最重要的产品原则是：

> 本项目的优势不在于让 ChatGPT Web 拥有最多工具，而在于让 ChatGPT Web 在 Windows + Chrome 上安全、可控、可诊断、可审计地参与本地开发工作流。

`docs/prd_vnext.md` 现在已经抓住了主方向，但需要尽快补上第五个参考仓库 `mcp_bridge_server`，并把 Local Gateway、result cache、server lifecycle、端口管理、Windows 分发这些服务端能力写得更明确。

同时，DeepseekWeb-enhance 的完整分析进一步说明：userscript 原型、本地 FastAPI bridge、shared panel UI、external MCP stdio adapter 和 preset 机制很值得吸收；但它的直接 shell、直接 write_file、内部 API 会话管理、外部工具自动合并，以及 `0.0.0.0 + CORS *` 这类默认暴露面，都不应成为本项目的产品默认值。
