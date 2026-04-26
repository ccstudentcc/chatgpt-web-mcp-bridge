# ChatGPT Web Local Agent Bridge PRD vNext

## 0. 文档信息

- 产品名称：ChatGPT Web Local Agent Bridge
- 当前文档：vNext PRD / 竞品参考路线版
- 文件名：`docs/prd_vnext.md`
- 与现有 PRD 的关系：本文不覆盖现有 `docs/prd.md`。现有 `docs/prd.md` 继续作为 v0.1 执行真相；本文用于定义后续版本目标、竞品参考、差异化策略和中长期路线。
- 目标平台：ChatGPT Web + Windows + Chrome
- 当前基础：已有 ChatGPT Web MCP-style JSON block、本地 Gateway、只读工具、batch 执行、安全路径策略、userscript 注入能力，以及临时 high-risk `write_file` 自举写入能力。
- 参考综合分析：`docs/reference-five-repos-synthesis-analysis.md`

---

## 1. 背景与问题定义

当前 v0.1 已经验证了 ChatGPT Web 可以通过结构化 `mcp` JSON block 调用本地低风险工具，并完成：

- 工具发现
- 本地只读工具执行
- 多工具 batch 串行执行
- 失败即停止
- 敏感路径阻断
- workspace 越界阻断
- 禁用高风险工具
- 结果回填与自动发送
- 临时 `write_file` 写入链路验证

但从竞品视角看，单纯“让网页 AI 调本地工具”已经不是充分差异化能力。`tmp/reference` 中的参考项目说明，竞品已经覆盖以下方向：

1. 多平台 Web AI 到 MCP 工具桥接。
2. DeepSeek Chat 会话管理增强。
3. DeepSeek Chat 本地 MCP 工具调用。
4. Chrome Extension 形态下的多层 fallback 机制。
5. 本地/远程 MCP server 接入。
6. 每工具权限控制、确认弹窗、日志与可视化状态。
7. 平台适配配置化：API 路径、promptPath、response path、UI parsing、input injection 均可配置。
8. 独立 Local Gateway、外部 MCP server 生命周期、result cache、端口管理和打包分发。
9. Docker/sandbox、插件/recipe/store 等更大生态叙事。

因此，本项目后续不能只做 “ChatGPT 版 ds-mcp-bridge” 或 “小型 MCP-SuperAssistant”，而应升级为：

> 面向 ChatGPT Web 的安全优先本地开发工作流增强器。

其中，“安全优先”不是一句定位文案，而是必须落实到默认只读、写入 proposal 化、run_task 白名单、外部 MCP 默认 hidden/disabled/ask_every_time、Gateway 仅本地监听、CORS allowlist、审计与诊断可复制等具体约束。

---

## 2. 产品定位

### 2.1 一句话定义

ChatGPT Web Local Agent Bridge 是一个面向 ChatGPT Web 的安全优先本地开发工作流增强器：它让 ChatGPT Web 能在受控边界内读取本地项目、调用本地工具、管理会话、生成可审查修改，并通过权限、审计和确认机制保持用户控制。

### 2.2 定位升级

v0.1 定位：

> ChatGPT Web MCP Bridge：让 ChatGPT Web 通过结构化 `mcp` JSON block 调用本地只读工具。

vNext 定位：

> ChatGPT Web Local Agent Bridge：以 MCP-style 工具桥为基础，整合会话管理、仓库工作流、安全写入、白名单任务执行、审计日志、诊断恢复和未来 MCP 生态接入。

### 2.3 核心差异化

本项目不追求在早期覆盖所有 AI 平台，也不追求默认开放所有本地能力。核心差异化是：

1. **ChatGPT Web 深度适配**：优先把 ChatGPT Web 的请求注入、工具块解析、结果回填、send button 等链路做稳。
2. **Windows + Chrome 一等公民**：面向 Windows 开发者的本地仓库工作流，而不是抽象平台 demo。
3. **默认安全**：只读优先，写入必须 proposal，高风险工具默认禁用，外部 MCP 默认不向模型暴露。
4. **本地 Gateway 产品化**：Gateway 不只是临时 localhost server，而是包含 tool registry、policy、audit、proposal、result cache、external MCP manager 和 diagnostics 的本地服务层。
5. **开发工作流闭环**：从读仓库、搜索、审查、生成 diff、确认应用，到运行测试和记录审计。
6. **会话增强整合**：吸收 DS Enhance 的会话分类、搜索、导出、Fork、重命名思路，但优先做本地标签、当前会话导出、tool history 和 workspace 绑定，不早期读取平台内部 token/API。
7. **配置化适配，但不牺牲主线**：吸收 mcp-bridge 的平台配置化思路，但 v0.x 仍以 ChatGPT Web 深度体验为主线。

---

## 3. 竞品与参考项目分析

本节基于 `tmp/reference` 中的本地参考项目，以及对应分析文档：

- `tmp/reference/DeepseekWeb-enhance`
- `tmp/reference/mcp-bridge`
- `tmp/reference/mcp_bridge_server`
- `tmp/reference/mcp-link`
- `tmp/reference/MCP-SuperAssistant`

### 3.1 DeepseekWeb-enhance / DS Enhance

DS Enhance 是 DeepSeek Chat 的浏览器增强工具集，由两个脚本组成：

| 脚本 | 定位 | 值得参考的能力 |
|---|---|---|
| `ds-enhance` | DeepSeek Chat 会话管理增强 | 批量删除、Fork、分类、搜索、导出、批量重命名、快捷键、共享面板 UI |
| `ds-mcp-bridge` | DeepSeek Chat + 本地 MCP 工具桥 | SSE 拦截、工具调用检测、工具结果回填、本地 FastAPI bridge、Shell、文件读写、搜索、网页抓取、外部 MCP server 接入 |

其重要启发：

1. 会话管理和本地工具桥可以共享基础设施，但保持模块边界。
2. 对话管理能力本身有强需求，不能只做工具桥。
3. 本地 MCP 工具桥可以通过轻量 userscript + localhost server 方式快速跑通。
4. 外部 MCP server 接入是重要增强项。
5. userscript 阶段也需要 panel-side UI 承载状态、测试、设置和恢复入口。
6. Preset 机制适合作为外部 MCP server 的本地配置模板来源。

需要公平看待的是：`ds-mcp-bridge` 并不是完全没有安全边界。其本地工具实现已经包含 workspace path validation、dangerous command pattern blocking、timeout、文件大小限制等基础保护。它的真正风险不在于“没有安全”，而在于仍然将 `execute_command` / `write_file` 这类强能力作为可直接调用工具暴露，并且服务端默认形态中存在 `0.0.0.0`、CORS 全开等暴露面风险。本项目的差异化应进一步前移到产品层：默认只读、强能力 ask every time、写入 proposal 化、命令白名单化、Gateway 仅本地监听、CORS allowlist、审计可视化。

本项目对应策略：

- 短期追平 `ds-mcp-bridge` 的本地工具桥核心体验，但默认更安全。
- userscript 阶段吸收其轻量面板和快速闭环，而不是长期停留在单 userscript 巨文件。
- 中期吸收 `ds-enhance` 的会话管理能力，但优先做当前会话导出、本地标签、tool history 和本地索引。
- 长期把会话、工具、仓库、审计整合为一个 ChatGPT Web 开发工作流产品。

### 3.2 mcp-bridge

`mcp-bridge` 是多平台浏览器扩展 + 本地桥接服务方案，支持 DeepSeek、通义千问、腾讯元宝、豆包等，ChatGPT/Grok 处于适配方向。

值得参考的能力：

1. **Chrome Extension 正式形态**：不是只停留在 userscript。
2. **多平台配置化**：通过 `api_list.json` 配置不同 AI 平台的 API、promptPath、response、input selector。
3. **四层保障机制**：
   - API 解析
   - UI DOM 解析
   - 重新检测
   - 手动输入
4. **服务/工具两层管理**：Service 与 Tool 分层。
5. **可视化状态面板**：右下角浮窗展示工具执行状态。
6. **设置页**：端口配置、服务管理、站点配置、配置合并。
7. **缓存与分段读取**：大结果缓存、流式搜索、精确定位、分段获取。
8. **用户手册完整度**：安装、配置、使用、故障排除、诊断信息收集都较完整。

本项目对应策略：

- v0.x 继续坚持 ChatGPT Web only，但技术上预留平台 adapter 架构。
- 先将 fallback 状态机和面板诊断做扎实，再迁移 Chrome Extension。
- 增加多层 fallback，不让工具调用只依赖单一检测方式。
- 增加大结果缓存与分段读取，避免模型上下文和页面输入框被大结果撑爆。
- 补齐“用户路径”文档：快速开始、安装、配置、使用教程、故障排除、诊断信息收集。

### 3.3 mcp_bridge_server

`mcp_bridge_server` 是 `mcp-bridge` 浏览器扩展对应的本地 FastAPI MCP proxy。它的参考价值主要在 Gateway 侧，而不是浏览器侧：外部 MCP server 配置、stdio/SSE 连接、两阶段工具发现、工具执行、result cache、服务重启/关闭、端口管理和 Windows 打包分发。

值得参考的能力：

1. **Local Gateway 独立形态**：浏览器扩展通过 HTTP REST API 调本地服务，本地服务再代理 stdio/SSE MCP server。
2. **外部 MCP server 管理**：通过配置管理多个 MCP server，支持 enabled/disabled、type、command、args、env、url、timeout 等字段。
3. **两阶段工具发现**：先返回 service/server 摘要，再按需获取具体 server 的 tool list，降低初始 catalog 体积。
4. **服务生命周期**：支持 reload、restart-server、shutdown-server 等操作，适合后续 Options Page 管理。
5. **大结果缓存**：超过阈值返回 cached_reference，支持内存/文件缓存、分页读取、搜索、上下文获取。
6. **端口管理**：启动前检测端口占用，能给出清晰错误信息。
7. **Windows 分发经验**：`.bat` 启动脚本、PyInstaller 打包、控制台日志、SHA256 校验等。

本项目对应策略：

- 将 Local Gateway 作为一等产品模块，而不是浏览器层的附属服务。
- v0.3 最小外部 MCP adapter 优先支持 stdio，HTTP/SSE 作为 P1/Spike，远程 MCP 后置。
- Gateway 默认只监听 `127.0.0.1`，不得默认 `0.0.0.0`。
- CORS 必须 allowlist，不允许生产默认 `allow_origins=*`。
- 外部 server 默认 disabled，外部 tool 默认 hidden，执行策略默认 ask_every_time。
- 配置更新必须 schema validation、secret redaction、diff preview。
- 服务生命周期、配置变更、工具调用、result cache 引用都必须进入 audit log。

### 3.4 MCP-SuperAssistant

MCP-SuperAssistant 是多平台 MCP 浏览器扩展，支持 ChatGPT、Gemini、Perplexity、Grok、Google AI Studio、OpenRouter、DeepSeek、Kimi、Qwen 等。

值得参考的能力：

1. **MV3 工程形态**：pnpm workspace + Vite + TypeScript + Chrome Extension。
2. **MCP transport abstraction**：支持 SSE、Streamable HTTP、WebSocket 等连接形式。
3. **站点 adapter registry**：以插件方式管理 ChatGPT、Gemini、DeepSeek、Kimi、Qwen 等站点 adapter。
4. **工具调用 parser / renderer**：支持 streaming、partial JSON、多行 JSON、JSONL、XML/ANTML、CodeMirror/Monaco 等复杂场景。
5. **工具卡片、RUN 按钮、自动执行、自动提交**。
6. **sidebar UI 与偏好持久化**。
7. **duplicate guard / execution tracker**：避免 DOM 重新渲染导致重复执行。

弱点或本项目可切入处：

1. 使用流程仍强调需要插入/附加 MCP working instructions prompt。
2. 多平台泛化会牺牲对单个平台的深度体验。
3. 安全边界取决于外部 MCP server 与用户配置，不一定聚焦本地仓库工作流。
4. 全局 autoExecute 思路不适合本项目直接照搬，必须改为 per-tool policy。
5. remote config、analytics、多站点 adapter 对本项目 MVP 是噪声。

本项目对应策略：

- 不在早期追求更多平台，而是通过 ChatGPT Web 深度体验建立第一优势。
- 将 request-layer live catalog injection 作为默认路径，降低手动插入 prompt 的摩擦。
- 增加 panel-side tool card / result card / proposal card，让工具调用不只是文本回填。
- 早期引入最小外部 MCP adapter，但必须纳入本项目的风险分级和权限策略。
- v0.2 起抽出 NormalizedToolCall、ToolResult、ToolCallParser、duplicate guard，避免解析逻辑散落在 UI 中。

### 3.5 MCP Link

MCP Link 是更宏大的生态型项目，强调 browser extension + server + mobile + IoT + store/recipe/plugin 体系，并强调安全、审计、权限控制、Docker sandbox、远程/本地工具。

值得参考的能力：

1. **每工具权限控制**：工具可见性与工具调用审批分离。
2. **运行时访问策略**：每次询问、自动允许、Always allow / YOLO mode。
3. **透明工具输出**：展示请求、响应、时间戳。
4. **远程工具开箱即用，本地工具可选增强**。
5. **Docker sandbox**：降低强工具调用风险。
6. **Recipe / plugin / store 生态叙事**。
7. **法律、安全、隐私、欢迎页、贡献协议等外围产品化文档完整**。

本项目对应策略：

- 采用“工具可见性”和“工具执行权限”分层。
- 每个工具拥有独立策略：model visibility、UI visibility、enabled、risk、execution policy 分离。
- 增加审计面板展示请求、参数摘要、响应摘要、耗时、风险等级。
- 将 Docker sandbox 作为 P2/P3 高风险任务执行方向，而不是 v0.x 必做。
- 暂不做 store/monetization，但可预留 adapter/recipe 概念。
- 不照搬 `<all_urls>`、debugger、cookies、history、bookmarks、nativeMessaging 等高权限默认组合。

---

## 4. 竞品能力矩阵

| 能力 | DS Enhance | mcp-bridge | mcp_bridge_server | MCP-SuperAssistant | MCP Link | 本项目 vNext 目标 |
|---|---:|---:|---:|---:|---:|---:|
| ChatGPT Web 支持 | 无 | 规划/适配中 | 浏览器无关 | 有 | 有 | 深度支持 |
| DeepSeek 支持 | 强 | 强 | 浏览器无关 | 有 | 可能支持 | P2 可选 |
| 本地工具桥 | 有 | 强 | 强 | 强 | 强 | 强 |
| Local Gateway 产品化 | 中 | 中 | 强 | 中 | 中 | 强 |
| 会话管理 | 强 | 弱 | 无 | 弱 | 弱 | 强，但本地优先 |
| 外部 MCP server | 有 | 有 | 强 | 强 | 强 | 早期 Spike，随后 P0 stdio |
| Shell | 有基础安全 | 取决于 MCP server | 取决于 MCP server | 取决于 MCP server | 可通过工具实现 | 默认禁用，替换为白名单任务 |
| 文件写入 | 直接 write_file | 取决于 MCP server | 取决于 MCP server | 取决于 MCP server | 可通过工具实现 | proposal + confirm |
| 多平台 | DeepSeek only | 多平台 | 不涉及 | 多平台 | 多平台 | 先 ChatGPT only，后 adapter |
| 平台适配配置化 | 弱 | 强 | 不涉及 | adapter plugin | recipe 化 | P1 预留，Chrome Extension 后增强 |
| fallback 机制 | 有基础 | 四层保障 | 不涉及 | 有检测/手动执行 | extension + recipe | 必须补强状态机 |
| 工具权限 | 基础 | 服务启用/禁用 | 服务启用/禁用 | 工具启用/禁用 | 每工具策略完整 | 每工具策略完整 |
| 审计日志 | 弱 | 状态面板 | 控制台/错误回传为主 | 工具卡片 | 透明请求/响应 | 强审计 |
| result cache | 弱 | 强 | 强 | 部分依赖 server | 取决于工具 | v0.3 contract，v0.8 完整 |
| 服务生命周期 | 弱 | 有配置管理 | 强 | 有连接管理 | 有生态叙事 | v0.3 起纳入 Gateway |
| 端口管理 | 弱 | 有端口配置 | 强 | 有连接配置 | 视实现而定 | Windows-first 必备 |
| 安全模型 | 基础防护 + 强工具直出 | 取决于配置 | 可用性强，安全默认需收紧 | 取决于 MCP server | 强调安全 | 默认安全、仓库边界、可审计 |
| 用户文档 | 中 | 强 | 强 | 中强 | 强 | 必须补齐 |
| 诊断与故障排除 | 中 | 强 | 强 | 中 | 中强 | 必须补齐 |

---

## 5. 产品原则

### 5.1 ChatGPT Web 深度优先

v0.x 不追求多平台覆盖。平台扩展只能在 ChatGPT Web 主链路稳定后进行。

### 5.2 安全能力优先于强工具能力

Shell、写文件、网页抓取、外部 MCP server 都是强能力，但不能以默认自动执行方式开放。

### 5.3 工具可见性与执行权限分离

工具配置必须拆分为多个独立字段，而不是用单个策略枚举混合表达。

```json
{
  "tool": "builtin.read_file",
  "modelVisibility": "visible",
  "uiVisibility": "visible",
  "enabled": true,
  "risk": "low",
  "executionPolicy": "auto",
  "confirmationRequired": false
}
```

字段定义：

| 字段 | 可选值 | 含义 |
|---|---|---|
| `modelVisibility` | `hidden` / `visible` / `neverExpose` | 是否向模型暴露 |
| `uiVisibility` | `hidden` / `visible` | 是否在 UI 展示 |
| `enabled` | boolean | 当前是否可执行 |
| `risk` | `low` / `medium` / `high` / `critical` / `unknown` | 风险等级 |
| `executionPolicy` | `deny` / `manual_only` / `ask_every_time` / `proposal_only` / `auto` | 执行策略 |
| `confirmationRequired` | boolean | 是否强制确认 |
| `audit` | boolean | 是否记录审计日志 |

示例：

```json
{
  "tool": "builtin.run_pwsh",
  "modelVisibility": "hidden",
  "uiVisibility": "visible",
  "enabled": false,
  "risk": "high",
  "executionPolicy": "deny",
  "confirmationRequired": true,
  "audit": true
}
```

### 5.4 Tool Policy Decision 必须流程化

系统不得只通过一个全局 autoExecute 开关决定是否执行工具。每次工具调用都必须经过统一 Policy Engine，并产生可审计的 policyDecision。

决策流程：

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

规则：

1. schema validation 失败不得进入执行。
2. 未 namespace 化的外部工具不得进入自动执行链路。
3. duplicate guard 必须在自动执行前生效。
4. 手动粘贴、DOM 重扫、startup rescan 也必须经过同一 policy decision。
5. policyDecision 必须进入 ToolCallCard 和 audit log。

### 5.5 写入必须 proposal 化

模型不能直接写文件。写入链路必须是：

```text
生成 proposal
→ 展示 diff
→ 用户确认
→ apply
→ 审计记录
```

临时 `write_file` 仅作为自举开发工具存在，必须满足：

- `risk=high`
- `requiresConfirmation=true`
- 需要显式配置启用
- 不进入自动执行链路
- 不进入公开默认 model catalog
- 后续正式版本必须回收为 proposal + confirm 主路径

进入 v0.4 后：

- `write_file` 默认关闭。
- README 将 `write_file` 标为 development escape hatch。
- 正式写入主路径迁移到 proposal。
- 所有写入文档与示例改为 `write_file_proposal` + `apply_proposal`。

### 5.6 Shell 不作为主产品能力

`run_pwsh` 可以保留为开发/实验入口，但正式能力应是 `run_task` 白名单任务：

```text
run_task lint
run_task test
run_task build
run_task git-status
run_task git-diff-stat
```

不允许模型传入自由命令字符串并执行。即使是白名单任务，也要做 dangerous pattern 二次检查、cwd 限制、timeout、stdout/stderr 分离、输出脱敏和 result cache。

### 5.7 多层 fallback 必须状态机化

参考 `mcp-bridge` 的四层保障机制，本项目需要形成明确状态机，而不是只列 fallback 名称。

核心状态：

```text
request_hook_active
→ catalog_injected
→ assistant_stream_observed
→ mcp_block_detected_from_stream
→ mcp_block_detected_from_complete_response
→ mcp_block_detected_from_dom
→ startup_rescan_detected
→ manual_paste_detected
→ normalized_batch_created
→ permission_checked
→ execution_pending
→ executing
→ result_ready
→ inserted
→ sent
→ completed / failed
```

规则：

1. 每一层 fallback 都必须产出同一个 NormalizedToolCallBatch。
2. 去重 key 必须稳定：`sourceMessageId + toolName + normalizedArgumentsHash`。
3. 同一个 toolCallKey 不重复自动执行。
4. 用户手动 retry 必须生成新的 attemptId。
5. fallback 不得绕过 permission policy。
6. 手动粘贴和重新检测也必须进入同一审计链路。
7. 任一 fallback 失败时必须记录失败层级、失败原因和下一步可操作入口。

### 5.8 大结果不直接塞回模型

所有大文件、大 grep 结果、长命令输出、外部 MCP 大响应都必须经过摘要、截断、缓存或分页机制，避免 ChatGPT 输入框和上下文被撑爆。

从 v0.3 开始，所有工具结果都必须经过统一 ToolResult envelope。超过阈值的结果不得直接回填完整内容，而应返回 `cached_reference`。v0.8 再补完整 UI、搜索、清理和持久化管理。

轻量 ToolResult envelope：

```json
{
  "resultType": "inline | cached_reference",
  "resultId": "...",
  "sourceTool": "builtin.grep_files",
  "summary": "Found 248 matches in 32 files.",
  "truncated": true,
  "totalItems": 248,
  "totalSizeChars": 30520,
  "expiresAt": "2026-04-26T01:00:00.000Z"
}
```

### 5.9 诊断优先

任何失败都必须让用户知道“失败在哪一层”和“下一步怎么恢复”。参考 `mcp-bridge` 用户手册，本项目必须提供：

- Gateway health 检查入口
- Tool catalog 检查入口
- 最近一次 request injection 状态
- 最近一次 tool detection 状态
- 最近一次 policy decision 状态
- 最近一次 insertion / auto-send 状态
- 复制诊断信息按钮
- 手动重扫最后一条消息
- 手动粘贴 tool call
- 手动复制 tool result

### 5.10 平台适配配置化，但不要过早多平台化

吸收 `mcp-bridge` 的 `api_list.json` 思路，但本项目早期只配置 ChatGPT Web adapter。后续 adapter schema 需要覆盖：

- `hostname`
- `api`
- `promptPath`
- `response.type`
- `response.contentPaths`
- `uiParsing.messageContainer`
- `uiParsing.contentSelector`
- `input.selector`
- `input.submitStrategy`
- `newConversationFlag`
- `skipRequestModification`
- `onLoadTip`

### 5.11 Local Gateway 安全基线

Local Gateway 是本项目的核心信任边界，必须采用安全默认值：

- 默认只监听 `127.0.0.1`。
- 默认不允许 `0.0.0.0` / 局域网访问。
- CORS 必须使用 allowlist，不允许生产默认 `allow_origins=*`。
- 浏览器侧访问 Gateway 应带 local access token 或等价 trusted local 校验。
- health / diagnostics 不得泄露 secret、token、完整 env。
- 外部 MCP server 的 env 必须脱敏展示和脱敏日志。
- 错误 traceback 可进入本地 debug log，但默认给模型和 UI 的错误必须脱敏。
- host binding 与 CORS 策略必须进入 acceptance/security 测试。

### 5.12 外部 MCP 默认保守

外部 MCP server 和外部工具默认值必须保守：

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

Preset 安装后也必须遵守同样默认值：server 默认 disabled，tools 默认 hidden，executionPolicy 默认 ask_every_time，secret params 单独输入并脱敏保存，安装前展示风险说明和配置 diff。

---

## 6. 目标架构

```text
ChatGPT Web
  ↓
Browser Layer
  - Userscript now / Chrome Extension later
  - Request-layer catalog injection
  - Tool call detection
  - Panel-side tool card / result card / proposal card
  - Conversation manager
  - Fallback diagnostics
  - Site adapter config
  ↓
Local Gateway
  - 127.0.0.1 only
  - CORS allowlist / trusted local token
  - Workspace policy
  - Tool registry
  - Permission engine
  - Audit log
  - Proposal store
  - External MCP adapter
  - Result cache
  - Diagnostics service
  - Port manager
  ↓
Workflow Tools
  - builtin.read_file
  - builtin.list_directory
  - builtin.search_files
  - builtin.grep_files
  - external.<server>.<tool>
  - builtin.write_file_proposal
  - builtin.apply_proposal
  - builtin.run_task
```

### 6.1 Browser Layer 责任

- 注入 live MCP catalog。
- 检测工具调用。
- 管理 fallback 状态。
- 展示 panel-side tool card。
- 插入工具结果并可选自动发送。
- 暴露诊断面板。
- 后续 Chrome Extension 形态下提供 Side Panel / Options / Popup。

### 6.2 Gateway 责任

- 只监听 `127.0.0.1`。
- 管理 workspaceRoot。
- 执行路径校验与敏感路径阻断。
- 管理工具注册表。
- 管理权限策略。
- 写审计日志。
- 管理 proposal。
- 管理 result cache。
- 代理外部 MCP server。
- 管理外部 MCP server 生命周期。
- 提供诊断包和端口占用提示。

### 6.3 Site Adapter 责任

短期仅服务 ChatGPT Web，长期抽象为 adapter。Site Adapter 不应是一个巨大的单对象，而应拆成四层：

```text
SiteAdapter =
- NetworkAdapter: request hook, response parser, catalog injection
- DOMAdapter: input, submit button, assistant messages, redetect
- InteractionAdapter: insert text, submit, attach files
- DiagnosticsAdapter: collect current site state
```

示例 schema：

```json
{
  "name": "chatgpt",
  "hostname": "chatgpt.com",
  "network": {
    "api": ["/backend-api/conversation"],
    "promptInjection": {
      "strategy": "request_layer",
      "paths": ["messages"]
    },
    "responseParsing": {
      "type": "sse",
      "contentPaths": []
    }
  },
  "dom": {
    "uiParsing": {
      "enabled": true,
      "messageContainer": [],
      "contentSelector": []
    },
    "input": {
      "selector": "#prompt-textarea",
      "fallbackSelectors": ["[contenteditable=\"true\"]", "textarea"]
    },
    "submit": {
      "strategy": "button_then_enter",
      "buttonSelectors": ["button[data-testid=\"send-button\"]", "button[type=\"submit\"]"]
    }
  },
  "diagnostics": {
    "collectAdapterStatus": true,
    "collectLastAssistantMessage": true
  }
}
```

### 6.4 Gateway API Contract

Gateway API 至少包含：

```text
GET  /health
GET  /catalog
POST /execute
GET  /diagnostics
GET  /audit
GET  /results/{resultId}
POST /results/{resultId}/search
POST /results/{resultId}/context
GET  /servers
GET  /servers/{serverName}/status
POST /servers/{serverName}/start
POST /servers/{serverName}/stop
POST /servers/{serverName}/restart
POST /servers/{serverName}/refresh-tools
```

基础要求：

- `/health` 不只返回 `ok`，还应返回 version、workspaceRoot、trustedLocalMode、tool counts、external server counts、lastError summary。
- `/catalog` 返回的是经过 policy 过滤的 model-visible catalog，不等于 raw tool registry。
- `/execute` 必须接收 namespace 化 toolName，并带 callId、sourceMessageId、detectionSource 等上下文。
- `/diagnostics` 必须默认脱敏。
- `/audit` 可查询工具调用、policy decision、proposal、server lifecycle 和配置变更。
- result cache API 支持分页、搜索和上下文读取。
- external MCP server lifecycle API 必须记录 event log / audit log。

### 6.5 工具命名空间规则

所有工具必须使用稳定 namespace：

```text
builtin.read_file
builtin.grep_files
builtin.write_file_proposal
builtin.run_task
external.filesystem.read_file
external.github.create_issue
```

规则：

1. 外部 MCP tool 不得以裸工具名进入 model catalog。
2. 若外部工具与内置工具同名，必须保留两者并通过 namespace 区分，不允许覆盖。
3. 未 namespace 化的外部工具不得进入自动执行链路。
4. UI 可以展示短名，但 raw request / audit log 必须记录完整 namespace。

### 6.6 Windows-first Local Gateway 约束

默认路径建议：

```text
Gateway 默认配置目录：
%APPDATA%\chatgpt-web-local-agent-bridge\config

日志目录：
%APPDATA%\chatgpt-web-local-agent-bridge\logs

缓存目录：
%APPDATA%\chatgpt-web-local-agent-bridge\cache

PID / lock 文件：
%APPDATA%\chatgpt-web-local-agent-bridge\run
```

端口管理要求：

- 默认端口：`8024`。
- Gateway 启动时必须检测端口占用并给出清晰错误信息。
- 默认不自动 kill 占用端口的进程。
- 只有确认是本项目旧 Gateway 的 pid，才允许安全重启。
- `--auto-kill-port` 只能作为显式开发选项，不能作为默认行为。

---

## 7. 分版本路线图

## v0.1.1：文档口径与验收固化

### 目标

把当前已跑通的 v0.1 只读工具桥做成可信、可复测、可对外展示的版本。

### 范围

1. README 口径同步。
2. SPEC / PRD / TASK_STATUS 口径同步。
3. `tool_result_batch` schema 固化。
4. 新增 `docs/acceptance.md`。
5. 新增 `docs/security.md`。
6. 新增 `docs/troubleshooting.md`。
7. 补充竞品定位说明。
8. 标注临时 `write_file` 自举能力的边界。
9. 将 `mcp_bridge_server` 作为独立参考来源写入 vNext 口径。
10. 将 Local Gateway host/CORS 安全基线写入安全文档和验收用例。

### 关键修改

#### README live catalog 口径

将旧口径：

```text
use Insert MCP list or Copy MCP list once per conversation
```

改为：

```text
The userscript injects the current live MCP catalog into outgoing ChatGPT conversation requests by default. Insert MCP list and Copy MCP list are fallback diagnostics.
```

#### tool_result_batch schema

固化当前实测结构：

```json
{
  "type": "tool_result_batch",
  "ok": false,
  "batchId": "...",
  "source": {
    "messageId": "..."
  },
  "summary": {
    "total": 2,
    "completed": 0,
    "failed": 1,
    "skipped": 1,
    "stoppedOnFailure": true
  },
  "items": [
    {
      "index": 0,
      "tool": "builtin.read_file",
      "callId": "...",
      "ok": false,
      "error": {
        "code": "PATH_OUTSIDE_WORKSPACE",
        "message": "The requested path is outside workspaceRoot."
      },
      "warnings": [],
      "durationMs": 0
    },
    {
      "index": 1,
      "tool": "builtin.read_file",
      "callId": "...",
      "status": "skipped",
      "reason": "SKIPPED_AFTER_BATCH_FAILURE"
    }
  ],
  "warnings": []
}
```

#### acceptance 用例

| 用例 | 期望结果 |
|---|---|
| `read_file README.md` | 成功 |
| `list_directory .` | 成功 |
| `grep_files` 无结果 | `ok: true`，matches 为空 |
| 多工具 batch | 顺序执行，统一回填 |
| `read_file .env` | `BLOCKED_PATH` |
| `read_file ../README.md` | `PATH_OUTSIDE_WORKSPACE` |
| batch 首项失败 | 后续项 `SKIPPED_AFTER_BATCH_FAILURE` |
| `run_pwsh` | gateway disabled，不执行 |
| `write_file` disabled | 返回 `TOOL_DISABLED` |
| `write_file` enabled + create 测试文件 | 仅开发模式允许，并必须记录高风险审计 |
| Gateway 默认 host | 只监听 `127.0.0.1` |
| CORS 默认策略 | 不允许生产默认 `allow_origins=*` |
| health 输出 | 不泄露 secret、token、完整 env |

### Exit Criteria

- README / SPEC / PRD / TASK_STATUS 口径一致。
- `docs/acceptance.md` 至少覆盖 13 条手动验收用例。
- `docs/security.md` 覆盖 workspace、sensitive path、trustedLocalMode、tool risk、batch stop、临时 write_file 边界、host binding、CORS allowlist。
- `docs/troubleshooting.md` 覆盖 Gateway、tool catalog、注入、检测、插入、自动发送的诊断流程。
- `pnpm -r lint`、`pnpm -r test`、`pnpm -r build` 通过。
- 至少完成一次真实 ChatGPT Web 浏览器会话验收。
- README 不再把 Insert/Copy MCP list 描述为主路径。

---

## v0.2：Parser、工具权限、Panel Tool Card 与外部 MCP Adapter Spike

### 目标

追平主流 MCP 桥的基本交互体验，但避免在 userscript 阶段把 UI 做重。v0.2 只做 panel-side tool cards，不把复杂卡片嵌入 ChatGPT 消息 DOM。

同时，v0.2 不只是 UI 版本，还要建立可控工具调用系统的骨架：parser、normalizer、policy engine、duplicate guard、diagnostics 和 audit record。

### 参考对象

- MCP-SuperAssistant 的 tool call card / RUN / Auto Execute / duplicate guard。
- MCP Link 的每工具权限策略。
- mcp-bridge 的状态面板和 fallback。
- DS MCP Bridge 的 stdio / HTTP 外部 MCP server proxy。

### P0 范围

1. Panel-side tool call card。
2. Panel-side tool result card。
3. NormalizedToolCall / NormalizedToolCallBatch 数据结构。
4. ToolResult envelope。
5. Tool permission policy。
6. Policy decision flow。
7. Duplicate guard：同一 toolCallKey 不重复自动执行。
8. Ask every time / auto low risk。
9. 手动 Run / Run All。
10. 执行历史面板。
11. 失败重试入口，retry 生成新的 attemptId。
12. 外部 MCP Adapter Spike：只验证 stdio server initialize / tools/list / tools/call。
13. 诊断面板：展示最近一次注入、检测、policy decision、执行、插入、发送状态。

### P1 范围

1. Inline lightweight badges：只在消息附近显示轻量状态，不做复杂交互。
2. 外部 MCP Adapter Spike 支持本地 HTTP/SSE 探索。
3. 工具调用成功率统计。
4. 复制诊断包。
5. SiteAdapter 分层接口草案。

### NormalizedToolCall 草案

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

### Duplicate Guard 规则

```text
toolCallKey = hash(sourceMessageId + toolName + normalizedArguments)
attemptId = 每次实际执行生成的新 id
```

规则：

- 同一 toolCallKey 不得自动执行多次。
- 用户手动 retry 必须生成新的 attemptId。
- audit log 保留每次 attempt。
- duplicate guard 不得阻止用户显式重新运行，但必须让用户知道这是 retry。

### 非目标

- 不在 v0.2 把复杂 Tool Card 插入 ChatGPT 消息 DOM。
- 不做 Chrome Extension 重 UI。
- 不默认自动执行外部 MCP 工具。
- 不把外部 HTTP/SSE MCP 做成正式功能。

### 验收标准

- 低风险内置工具可继续自动执行。
- medium/high 工具必须显示确认卡。
- disabled 工具不执行。
- 每次调用都有状态、结果、policy decision 和错误展示。
- Spike 能连接一个最小 stdio MCP server 并列出工具。
- 同一消息重复扫描不会重复自动执行。
- 用户可以复制诊断信息用于 issue / debug。

---

## v0.3：最小外部 MCP Adapter P0 + 轻量 Result Cache Contract

### 目标

接入标准外部 MCP server，但纳入本项目的风险分级、权限控制和审计模型。外部 MCP 接入要早做，但默认更保守。

同时，从 v0.3 开始引入轻量 result cache contract，避免外部 MCP 大结果、grep 大结果和后续 run_task 输出直接撑爆 ChatGPT 输入框。

### 参考对象

- DS MCP Bridge 的 `server/mcp.json` 外部 server 配置和 preset 机制。
- `mcp_bridge_server` 的 stdio/SSE proxy、两阶段工具发现、server lifecycle、result cache、端口管理。
- MCP-SuperAssistant 的 MCP transport abstraction。
- mcp-bridge 的 service/tool 分层。

### P0 支持传输

| 传输 | 范围 | 说明 |
|---|---|---|
| stdio | P0 | 本地 MCP server，仅 local subprocess |
| local HTTP / local SSE | P1 / Spike | 仅本机地址，默认关闭 |
| remote HTTP / remote SSE | 后期 | 默认关闭，不进入 v0.3 正式范围 |
| WebSocket | 后期 | 视需求评估 |

### 配置模型

```json
{
  "mcpServers": {
    "filesystem-local": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "D:/workspace"],
      "enabled": false,
      "modelVisibility": "hidden",
      "uiVisibility": "visible",
      "defaultExecutionPolicy": "ask_every_time",
      "risk": "unknown",
      "env": {},
      "timeoutMs": 30000
    }
  }
}
```

### 安全策略

- 外部 MCP server 默认 disabled。
- 外部 MCP tool 默认不向模型暴露。
- 外部 MCP tool 默认不自动执行。
- 外部 MCP tool 默认 ask_every_time。
- 每个外部工具必须经过风险分类。
- 用户可启用/禁用单个 server 与单个 tool。
- 外部工具输出必须进入 audit log。
- 支持每工具 ask / manual_only / deny / auto 策略。
- 外部 MCP server 的 env 必须脱敏展示和脱敏日志。
- 外部 MCP tool 名称必须命名空间化，避免和内置工具冲突。
- 外部 MCP stderr / transport error 必须进入 diagnostics，但默认给模型的错误要脱敏。

### Tool 命名规则

```text
builtin.read_file
builtin.grep_files
external.filesystem.read_file
external.github.create_issue
```

规则：

- P0 可以在 UI 中显示短名，但模型侧默认只暴露用户启用且风险策略允许的完整 namespace 工具。
- 外部 MCP tool 不得以裸工具名进入 model catalog。
- 若外部工具与内置工具同名，必须保留两者并通过 namespace 区分，不允许覆盖。

### Server Lifecycle

Gateway 应支持单个 external MCP server 的生命周期管理：

```text
GET  /servers
GET  /servers/{serverName}/status
POST /servers/{serverName}/start
POST /servers/{serverName}/stop
POST /servers/{serverName}/restart
POST /servers/{serverName}/refresh-tools
```

每次 lifecycle 操作必须记录 event log / audit log。

### 轻量 Result Cache Contract

从 v0.3 开始，工具结果统一经过 ToolResult envelope。超过阈值时返回 cached_reference：

```json
{
  "resultType": "cached_reference",
  "resultId": "...",
  "sourceTool": "external.filesystem.search",
  "summary": "Found 248 matches in 32 files.",
  "truncated": true,
  "totalItems": 248,
  "totalSizeChars": 30520,
  "expiresAt": "2026-04-26T01:00:00.000Z"
}
```

v0.3 只要求 contract 和基础分页读取；完整搜索、上下文读取、UI 管理在 v0.8 完成。

### Preset 策略

外部 MCP preset 只作为本地模板，不做 store：

- preset 安装后 server 默认 disabled。
- tools 默认 hidden。
- executionPolicy 默认 ask_every_time。
- secret params 单独输入并脱敏保存。
- 安装前展示风险说明和配置 diff。

### 验收标准

- 可配置一个 stdio MCP server。
- 可完成 initialize、tools/list、tools/call。
- 可禁用单个 server 与单个 tool。
- 高风险工具必须确认。
- 工具调用日志完整记录。
- 同名工具不会覆盖内置工具。
- 外部 server env 在 UI / diagnostics 中脱敏。
- 大结果返回 cached_reference，不直接完整回填。
- server start/stop/restart 进入 audit log。

---

## v0.4：安全写入 Proposal

### 目标

从只读工具桥升级到可审查文件修改流程，但不开放直接写文件。

### 新增工具

| 工具 | 风险 | 自动执行 | 说明 |
|---|---|---:|---|
| `builtin.write_file_proposal` | medium | 否 | 生成文件修改提案，不落盘 |
| `builtin.list_proposals` | low | 是 | 列出待确认提案 |
| `builtin.read_proposal` | low | 是 | 查看单个 proposal diff |
| `builtin.discard_proposal` | medium | 否 | 丢弃 proposal |
| `builtin.apply_proposal` | high | 否 | 用户确认后应用修改 |

### Proposal 模型

```json
{
  "proposalId": "...",
  "createdAt": "2026-04-26T00:00:00.000Z",
  "status": "pending",
  "summary": "Update README to clarify live catalog injection.",
  "files": [
    {
      "path": "README.md",
      "operation": "modify",
      "beforeHash": "...",
      "afterHash": "...",
      "diff": "..."
    }
  ]
}
```

### 安全限制

- 只允许 workspaceRoot 内文本文件。
- 敏感路径继续阻断。
- apply 前重新校验 hash，避免覆盖用户新修改。
- 不允许自动 apply。
- 不允许模型绕过 proposal 直接写文件。
- 默认不允许修改 lockfile，除非用户开启特定策略。
- 默认不允许新建隐藏文件。
- proposal 必须进入审计日志。
- proposal 必须支持 discard，避免积累不可见待处理项。

### 临时 write_file 回收策略

当前临时 `write_file` 仅用于项目自举开发。进入 v0.4 后：

- 默认关闭 `write_file`。
- `write_file` 不进入公开默认 model catalog。
- README 将 `write_file` 标为 development escape hatch。
- 正式写入主路径迁移到 proposal。
- 所有自动写入文档与示例改为 `write_file_proposal` + `apply_proposal`。

### 验收标准

- 模型能生成 proposal。
- proposal 不落盘修改目标文件。
- 用户确认后才 apply。
- apply 前后均有审计日志。
- 临时 `write_file` 默认关闭。
- 文档示例不再鼓励直接 replace 文件。

---

## v0.5：白名单任务执行 run_task

### 目标

用 `run_task` 替代任意 `run_pwsh`，支持常用开发任务，同时保持安全可控。

### 不做

- 不开放任意 PowerShell 命令自动执行。
- 不允许模型传入自由命令字符串并执行。

### 工具设计

```json
{
  "tool": "builtin.run_task",
  "args": {
    "task": "test",
    "cwd": ".",
    "timeoutMs": 120000
  }
}
```

配置示例：

```json
{
  "allowedTasks": {
    "lint": {
      "command": "pnpm -r lint",
      "cwd": ".",
      "timeoutMs": 120000,
      "risk": "medium"
    },
    "test": {
      "command": "pnpm -r test",
      "cwd": ".",
      "timeoutMs": 180000,
      "risk": "medium"
    },
    "build": {
      "command": "pnpm -r build",
      "cwd": ".",
      "timeoutMs": 180000,
      "risk": "medium"
    },
    "git-status": {
      "command": "git status --short",
      "cwd": ".",
      "timeoutMs": 30000,
      "risk": "low"
    },
    "git-diff-stat": {
      "command": "git diff --stat",
      "cwd": ".",
      "timeoutMs": 30000,
      "risk": "low"
    }
  }
}
```

### Contract

`run_task` 必须返回：

```json
{
  "task": "test",
  "cwd": ".",
  "exitCode": 0,
  "stdout": "...",
  "stderr": "...",
  "durationMs": 1234,
  "timedOut": false,
  "truncated": false,
  "resultRef": null
}
```

若 stdout/stderr 超过阈值，应返回 cached_reference：

```json
{
  "task": "test",
  "exitCode": 1,
  "durationMs": 1234,
  "timedOut": false,
  "stdout": "truncated preview...",
  "stderr": "truncated preview...",
  "truncated": true,
  "resultRef": {
    "resultId": "...",
    "summary": "Command failed with 42 stderr lines.",
    "totalSizeChars": 30520
  }
}
```

### 安全策略

- 默认所有 task 都需要用户确认。
- 用户可为低风险 task 设置自动执行。
- 禁止 destructive command。
- 即使是白名单命令，也要做 dangerous pattern 二次检查。
- `cwd` 必须在 workspaceRoot 内。
- 命令输出必须截断、脱敏、可分页。
- stdout / stderr 必须分开记录。
- exit code 必须返回给模型。
- timeout 必须强制执行。
- 环境变量默认最小化，不继承敏感配置，除非用户显式配置。

### 验收标准

- `run_task lint/test/build` 可执行。
- 任意未配置 task 被拒绝。
- 高风险命令无法通过 task 注入。
- 输出记录进入 audit log。
- 长输出进入 result cache，可分页读取。

---

## v0.6：会话管理增强

### 目标

吸收 `ds-enhance` 的对话管理能力，形成 ChatGPT Web 会话增强层。由于 ChatGPT Web 与 DeepSeek Chat 的 API、DOM、权限边界不同，本阶段必须按可行性分层，不直接承诺内部 API 能力。

### P0：当前会话增强

| 功能 | 说明 |
|---|---|
| 当前会话导出 | Markdown / JSON |
| 当前会话 tool history 导出 | 包含 tool call / tool result / error |
| 当前会话 snapshot | 复制当前可见上下文到本地 |
| 本地标签 | 给当前会话打本地标签 |
| workspace 绑定 | 当前会话绑定 workspaceRoot |

### P1：本地索引增强

| 功能 | 说明 |
|---|---|
| 本地会话索引 | 仅索引用户打开过或显式导出的会话 |
| 本地搜索 | 按标题、摘要、标签、tool history 搜索 |
| AI 标题 proposal | 只生成建议，不直接改线上标题 |
| 批量分类 proposal | 用户确认后写入本地分类 |

### P2：ChatGPT 内部 API 实验能力

| 功能 | 说明 |
|---|---|
| 会话列表读取 | 实验功能，需风险提示 |
| 批量重命名 | 实验功能，默认关闭 |
| Fork / Branch | 实验功能，视 ChatGPT Web 可行性评估 |
| 删除 / 归档 | 高风险，必须二次确认，默认关闭 |

### 安全要求

- P0/P1 默认不读取 ChatGPT token / Cookie / localStorage 敏感凭据。
- 优先采用 DOM 可见信息、本地索引和用户显式导出。
- 如果未来使用内部 API，必须作为实验功能并给出风险提示。
- 删除类操作必须二次确认，且默认不进入自动化链路。

### 验收标准

- 用户可以导出当前会话。
- 当前会话导出包含 tool call / result。
- 用户可以给当前会话打本地标签。
- 用户可以搜索本地已索引会话。
- 删除类操作必须二次确认。

---

## v0.7：Chrome Extension 正式形态

### 目标

从 Tampermonkey userscript 升级到 Chrome Extension，增强权限治理、UI 能力和可维护性。

v0.7 的核心不是一次性做完完整 Options，而是先完成稳定迁移：MV3 shell、Content Script / Page World Script / Service Worker 分层、Popup health、Basic Side Panel、原 userscript 能力迁移。

### 架构

```text
Chrome Extension
  - Content Script
  - Page World Script
  - Service Worker
  - Side Panel
  - Options Page
  - Popup
Local Gateway
  - Tool Registry
  - Permission Engine
  - Audit Log
```

### 参考对象

- `mcp-bridge` 的 extension + options + popup + status panel 结构。
- MCP-SuperAssistant 的 sidebar 与偏好持久化。
- MCP Link 的 popup、权限与日志思路。

### v0.7 P0 范围

| 能力 | 说明 |
|---|---|
| MV3 shell | 最小可安装扩展形态 |
| Content Script + Page World Script | request/response hook 与 DOM/输入操作分层 |
| Service Worker | 连接 Gateway、状态广播、配置读取 |
| Popup health | 展示 Gateway online/offline、workspaceRoot、版本 |
| Basic Side Panel | 展示最近 tool calls、结果、错误、复制诊断 |
| 原 userscript 能力迁移 | live catalog injection、mcp block detection、result insertion |
| Copy diagnostics | 一键复制脱敏诊断包 |
| 最小 Tool Card | 展示 tool name、args preview、status、result summary、error |

### v0.7 P1 范围

| 能力 | 说明 |
|---|---|
| Full Options Page | Gateway URL、automation toggles、tool policy |
| External MCP server UI | server 列表、启停、工具列表、配置 diff |
| Audit log UI | 查询、复制、清理 |
| Result cache UI | 查看、删除、复制 resultId |
| Advanced Site Adapter diagnostics | ChatGPT adapter 状态、selector 检测、fallback 状态 |
| Proposal UI | proposal card、diff 预览、apply/discard |

### Options Page 最终能力

| 能力 | 说明 |
|---|---|
| Gateway base URL | 默认 `http://127.0.0.1:8024` |
| Gateway health | 展示在线状态、workspaceRoot、trustedLocalMode |
| Automation toggles | autoExecute / autoInsert / autoSend，但最终以 per-tool policy 为准 |
| Tool policy | 每工具可见性、启用状态、执行策略 |
| Site adapter | ChatGPT adapter 配置与诊断 |
| MCP servers | 外部 server 列表、启停、工具列表 |
| Audit log | 查询、复制、清理 |
| Result cache | 查看、删除、复制 resultId |
| Export diagnostics | 一键复制诊断包 |

### Side Panel 必备能力

- Tool call cards。
- Result cards。
- Proposal cards。
- Retry / copy / insert / run 操作。
- Fallback 状态。
- 最近错误与下一步建议。

### 验收标准

- P0 阶段：Popup 可查看 Gateway health。
- P0 阶段：Basic Side Panel 可查看最近工具调用、结果、错误和诊断。
- Content Script 可稳定检测 ChatGPT 页面。
- Page World hook 失败时不破坏原始请求。
- 原 userscript 能力迁移完成。
- 可以导出诊断信息用于排障。
- P1 阶段：Options 可配置 Gateway URL、自动化开关、工具策略、外部 MCP server。

---

## v0.8：完整大结果缓存与分段读取

### 目标

参考 `mcp-bridge` 和 `mcp_bridge_server` 的缓存、流式搜索、精确定位和分段获取能力，解决大文件、大搜索结果、大命令输出导致的上下文溢出问题。

注意：v0.8 不是第一次引入 result cache。v0.3 已引入轻量 cached_reference contract；v0.5 已让 run_task 输出接入 cache。v0.8 的目标是补齐完整 UI、搜索、上下文读取、清理和持久化管理。

### 新增能力

| 能力 | 说明 |
|---|---|
| result cache UI | 大结果不直接塞回 ChatGPT，可在 UI 中管理 |
| get_result_page | 分页读取工具结果 |
| search_result | 在缓存结果中搜索 |
| get_context_lines | 获取目标行附近上下文 |
| result summary | 先返回摘要与索引，再按需展开 |
| cache cleanup | 过期清理、手动清理、按 workspace 清理 |

### Result Cache 模型

```json
{
  "resultId": "...",
  "sourceTool": "builtin.grep_files",
  "createdAt": "2026-04-26T00:00:00.000Z",
  "expiresAt": "2026-04-26T01:00:00.000Z",
  "summary": "Found 248 matches in 32 files.",
  "pageSize": 50,
  "totalItems": 248,
  "totalSizeChars": 30520
}
```

### 验收标准

- 大文件读取不会一次性回填过大内容。
- grep 大结果可分页。
- run_task 输出可截断和继续读取。
- 外部 MCP 大结果可返回 cached_reference。
- 缓存结果有过期策略。
- 用户可从 UI 中查看和清理缓存结果。
- cache expired 时有明确错误和恢复提示。

---

## v0.9：Sandbox / Docker 实验能力

### 目标

为高风险工具执行提供隔离环境，参考 MCP Link 的 Docker sandbox 思路。

### 范围

- Docker 环境检测。
- 沙盒任务执行。
- 只挂载指定 workspace 子目录。
- 网络权限可配置。
- 文件写入隔离。

### 非目标

- 不把 sandbox 作为 v0.x 默认依赖。
- 不承诺完全安全隔离。
- 不替代现有 workspace policy。

### 验收标准

- 用户可选择在 sandbox 中运行 task。
- sandbox 输出进入 audit log。
- 默认不启用 sandbox 自动执行。

---

## 8. 文档与用户路径要求

竞品项目里 `mcp-bridge` 和 `mcp_bridge_server` 的用户手册、配置指南、端口管理、重启服务和打包文档证明：这类工具不只是代码功能，用户能否装起来、查问题、恢复失败，直接影响可用性。因此 vNext 必须把文档作为产品的一部分。

### 8.1 必备文档

| 文件 | 目标 |
|---|---|
| `README.md` | 对外定位、快速开始、默认安全模型 |
| `docs/prd.md` | v0.1 执行真相 |
| `docs/prd_vnext.md` | 后续路线 |
| `docs/reference-five-repos-synthesis-analysis.md` | 五个参考仓库综合分析 |
| `docs/acceptance.md` | 手动验收用例 |
| `docs/security.md` | 安全模型与边界 |
| `docs/troubleshooting.md` | 故障排除 |
| `docs/tool-policy.md` | 工具权限策略 |
| `docs/external-mcp.md` | 外部 MCP server 配置 |
| `docs/diagnostics.md` | 诊断信息说明 |
| `docs/gateway.md` | Local Gateway API、端口、配置、日志、Windows 路径 |

### 8.2 快速开始路径

README 必须能让用户按以下路径跑通：

```text
pnpm install
pnpm build
pnpm dev:gateway
pnpm dev:userscript
Install userscript in Tampermonkey
Open ChatGPT Web
Ask ChatGPT to call mcp_list / read_file
```

### 8.3 文档按用户问题组织

文档不应只是文件列表，应直接回答用户任务：

| 用户问题 | 应落到的文档 |
|---|---|
| 我如何第一次跑通？ | `README.md` |
| 这个工具默认安全吗？ | `docs/security.md` |
| 为什么 Gateway 连不上？ | `docs/troubleshooting.md` / `docs/gateway.md` |
| 为什么 ChatGPT 没有输出 mcp block？ | `docs/troubleshooting.md` |
| 为什么工具没有执行？ | `docs/tool-policy.md` / `docs/diagnostics.md` |
| 为什么结果没插入？ | `docs/troubleshooting.md` |
| 外部 MCP server 怎么配置？ | `docs/external-mcp.md` |
| 配置外部 server 会不会泄露 token？ | `docs/security.md` / `docs/external-mcp.md` |
| 大结果为什么只返回 resultId？ | `docs/diagnostics.md` / `docs/gateway.md` |
| 如何复现验收？ | `docs/acceptance.md` |

### 8.4 故障排除路径

`docs/troubleshooting.md` 必须覆盖：

1. Gateway disconnected。
2. 端口被占用。
3. CORS / trusted local token 失败。
4. Tool catalog 为空或过期。
5. ChatGPT 没有输出 mcp block。
6. userscript 没有检测到 mcp block。
7. 工具执行失败。
8. 权限策略拒绝执行。
9. 结果无法插入输入框。
10. 自动发送失败。
11. batch 中断。
12. 写入工具 disabled。
13. workspace/path-policy 阻断。
14. external MCP server 启动失败。
15. result cache 过期或找不到。

### 8.5 诊断包

UI 需要提供 “Copy diagnostics”：

```json
{
  "appVersion": "...",
  "gateway": {
    "connected": true,
    "baseUrl": "http://127.0.0.1:8024",
    "trustedLocalMode": true,
    "workspaceRoot": "...",
    "host": "127.0.0.1",
    "corsMode": "allowlist"
  },
  "tools": {
    "total": 8,
    "enabled": 6,
    "modelVisible": 5
  },
  "externalMcpServers": {
    "total": 1,
    "enabled": 0,
    "running": 0
  },
  "lastInjection": {
    "ok": true,
    "strategy": "request_layer"
  },
  "lastDetection": {
    "source": "dom",
    "toolCount": 1
  },
  "lastPolicyDecision": {
    "tool": "builtin.read_file",
    "decision": "auto"
  },
  "lastExecution": {
    "tool": "builtin.read_file",
    "ok": true,
    "durationMs": 9
  },
  "lastInsertion": {
    "ok": true,
    "target": "contenteditable"
  }
}
```

诊断包必须默认脱敏，不包含 secret、token、完整 env、未脱敏 traceback。

---

## 9. 验收与测试重点

### 9.1 Gateway / Security Acceptance

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
| 端口占用 | 输出清晰错误，不默认 kill 进程 |
| diagnostics | 默认脱敏 |

### 9.2 Parser / Fallback Acceptance

| 用例 | 期望 |
|---|---|
| fenced `mcp` JSON block | 可解析为 NormalizedToolCallBatch |
| streaming partial block | incomplete 不执行 |
| DOM redetect | 产出同一 NormalizedToolCallBatch |
| manual paste | 进入同一 policy/audit 链路 |
| 重复扫描同一消息 | 不重复自动执行 |
| retry | 生成新的 attemptId |
| schema invalid | 不执行，并显示错误 |

### 9.3 External MCP Acceptance

| 用例 | 期望 |
|---|---|
| stdio initialize | 成功建立 session |
| tools/list | 工具命名空间化 |
| tools/call | 经过 policy decision |
| stderr 输出 | 被单独收集到 diagnostics |
| server stop/restart | lifecycle 进入 audit log |
| env secret | UI 和 diagnostics 中脱敏 |
| preset install | 默认 disabled / hidden |
| remote HTTP/SSE | 不进入 v0.3 P0，默认关闭 |

### 9.4 Result Cache Acceptance

| 用例 | 期望 |
|---|---|
| grep 大结果 | 返回 cached_reference |
| run_task 大 stdout | 不直接完整回填 |
| get_result_page | 可分页读取 |
| search_result | 可搜索缓存结果 |
| get_context_lines | 可取目标行上下文 |
| cache expired | 给出明确错误和恢复提示 |

---

## 10. 最终产品形态

长期目标不是单纯 MCP Bridge，而是：

```text
ChatGPT Web Local Agent Bridge
├─ MCP-style Tool Bridge
├─ Local Gateway
├─ External MCP Adapter
├─ Conversation Manager
├─ Safe Repo Workflow
├─ Proposal/Diff System
├─ Run Task Whitelist
├─ Result Cache
├─ Audit Log
├─ Diagnostics
├─ Site Adapter Config
└─ Chrome Extension UI
```

一句话愿景：

> 让 ChatGPT Web 安全、可审计、可确认地参与本地项目工作流。

---

## 11. 近期优先级

### 立即做

1. 完成 v0.1.1 文档同步。
2. 固化 batch schema。
3. 写 `docs/acceptance.md`。
4. 写 `docs/security.md`。
5. 写 `docs/troubleshooting.md`。
6. 写 `docs/gateway.md`。
7. 在 README 增加竞品差异化说明。
8. 标注临时 `write_file` 的自举边界。
9. 将 `mcp_bridge_server` 作为第五个独立参考源写入 PRD 和能力矩阵。
10. 将 Gateway host/CORS 安全基线加入验收。

### 下一步做

1. Panel-side tool card / result card。
2. NormalizedToolCall / ToolResult。
3. 权限策略引擎。
4. duplicate guard。
5. 诊断面板。
6. 外部 MCP Adapter Spike。
7. 最小 stdio MCP adapter。

### 中期做

1. `write_file_proposal`。
2. Proposal UI。
3. `run_task` 白名单任务。
4. 当前会话导出与本地标签。
5. Result cache 完整 UI。
6. Chrome Extension P0 迁移。

### 暂缓

1. 任意 `run_pwsh`。
2. 多平台适配。
3. 远程 MCP server 自动执行。
4. 读取 ChatGPT 内部 token/API。
5. Native Messaging。
6. Browser automation。
7. Store / monetization / mobile / IoT。
8. Remote config / analytics。

---

## 12. 结论

综合参考项目后，本项目的合理路线不是：

> 做一个更小的 MCP-SuperAssistant。

也不是：

> 做一个 ChatGPT 版 DS Enhance。

而是：

> 以 ChatGPT Web 深度适配为切口，做一个安全优先、开发者导向、可审计、可确认、可诊断的本地工作流增强器。

竞品已经证明“网页 AI 调工具”和“会话增强”都有需求。本项目要超过它们，必须在以下方向形成组合优势：

1. 比 DS MCP Bridge 更保守、更可审计，而不是简单否认其安全措施。
2. 比 DS Enhance 更懂本地项目工作流。
3. 比 mcp-bridge 更聚焦 ChatGPT Web 深度体验，同时吸收其 fallback、配置化适配、用户手册和缓存设计。
4. 单独吸收 mcp_bridge_server 的 Local Gateway、外部 MCP server lifecycle、result cache、端口管理和 Windows 分发经验。
5. 比 MCP-SuperAssistant 更低摩擦、更适合本地开发者，同时尽早补齐外部 MCP adapter。
6. 借鉴 MCP Link 的权限、审计和 sandbox 思路，但避免早期过度平台化。
7. 把诊断、验收、故障恢复作为核心产品体验，而不是附属文档。

最重要的产品原则是：

> 本项目的优势不在于让 ChatGPT Web 拥有最多工具，而在于让 ChatGPT Web 在 Windows + Chrome 上安全、可控、可诊断、可审计地参与本地开发工作流。
