# ChatGPT Web MCP Bridge PRD

## 0. 文档信息

- 产品名称：ChatGPT Web MCP Bridge
- 当前版本：v0.1
- 目标平台：ChatGPT Web + Windows + Chrome
- 本地 Shell 口径：`pwsh`
- 产品定位：面向开发者本地项目工作流的、安全优先的 ChatGPT Web 本地工具桥

---

## 1. 一句话定义

ChatGPT Web MCP Bridge 让 ChatGPT 网页端通过结构化 `mcp` JSON block 请求本地工具，在本机 `127.0.0.1` Gateway、`workspaceRoot`、敏感路径阻断、日志和能力开关约束下获取项目上下文；默认只读，必要时可显式开启受限写入。

它不是通用网页 AI 平台，不追求一开始支持所有站点，也不是为了让网页 AI 任意操控电脑。

---

## 2. 产品目标

### 2.1 v0.1 核心目标

- 只服务 ChatGPT Web。
- 跑通 “模型知道可用工具 → 输出 `mcp` block → userscript 检测 → Gateway 执行 → 结果回填 → 可选自动发送” 的最小闭环。
- 默认只开放低风险只读工具。
- 把 Windows + Chrome + `pwsh` 作为第一公民处理。
- 把安全边界写清楚，并作为产品卖点。
- 允许本地开发者在显式开启 `allowWrite=true` 后使用受限高风险 `write_file` 完成自举迭代，但它不属于默认自动执行面。

### 2.2 产品卖点

- ChatGPT Web only：不为多站点泛化牺牲稳定性。
- Windows 优先：路径、编码、`pwsh`、`rg` 缺失降级等都按 Windows 工作流设计。
- 安全优先：`workspaceRoot`、敏感路径黑名单、trusted local mode、日志、禁用高风险工具。
- 本地项目工作流优先：先解决读文件、列目录、找文件、搜文本。

### 2.3 非目标

- 不实现官方 ChatGPT MCP Apps 全协议兼容。
- 不支持所有网页 AI 平台。
- 不读取 Cookie、页面 token、浏览器凭据、localStorage 敏感信息。
- 不默认开放写文件、Shell、网络抓取、删除等高风险能力。
- 不承诺 ChatGPT 网页 DOM 永久稳定。

---

## 3. 目标用户与场景

### 3.1 目标用户

- Windows + Chrome 的个人开发者
- 在 ChatGPT 网页端做代码审查、PRD、排障、项目分析的人
- 想保留 ChatGPT Web 体验，但需要读取本地项目上下文的人

### 3.2 典型场景

#### 场景 A：读项目文件

用户让 ChatGPT 看 `README.md`、`package.json`、某个源码文件。

#### 场景 B：搜索项目

用户让 ChatGPT 查某个文件名、标识符、关键词或配置项出现位置。

#### 场景 C：先发现工具再调用

模型在用户发送消息时通过 userscript 的请求层 live MCP catalog 注入知道当前有哪些工具、示例参数是什么，再决定调用哪个工具。

#### 场景 D：后续扩展

未来可以增加 `write_file_proposal`、受限 `run_pwsh` 的更完整确认流，但不进入 v0.1 默认自动执行面。

---

## 4. 设计原则

### 4.1 ChatGPT Web Only

v0.1 只为 ChatGPT Web 适配。DOM 选择器、结果回填、发送按钮检测、以及对 ChatGPT 会话请求体的工具提示注入都以当前网页实现为唯一目标。

### 4.2 安全默认值保守

- 默认只开放低风险只读工具。
- 默认 trusted local mode 开启，但仍只监听本机。
- 默认三个自动化开关都开启，但自动化仅作用于 enabled 的低风险工具。
- `write_file` 即使显式启用，也必须保持 high risk、requiresConfirmation=true、手动执行。
- 高风险工具即使未来实现，也不得进入自动执行链路。

### 4.3 Live Truth Over Static Truth

模型看到的工具说明必须来自当前 Gateway `/tools` 返回，而不是写死在脚本里的过期样例。

### 4.4 明确退路

自动执行、自动插入、自动发送任一关闭，都必须退回对应手动路径，而不是让整条链路失效。

---

## 5. 总体架构

```text
ChatGPT Web
  ↓
Tampermonkey userscript
  ↓
Local Gateway (127.0.0.1:8024)
  ↓
Local tool registry
  ↓
Workspace files / optional future tools
```

### 5.1 ChatGPT Web

- 承载会话
- 接收 userscript 在出站会话请求中透明注入的 MCP catalog prompt
- 输出 `mcp` JSON block

### 5.2 Userscript

- 拉取 `/health` 与 `/tools`
- 构建 live MCP catalog prompt
- 在 ChatGPT 出站会话请求发出前透明注入 prompt
- 监听 assistant 回复中的 `mcp` block
- 执行 enabled 工具
- 回填结果
- 根据三个自动化开关决定是否自动执行、自动插入、自动发送

### 5.3 Local Gateway

- 只监听 `127.0.0.1`
- 提供 `/health`、`/tools`、`/call-tool`
- 管理 `workspaceRoot`
- 做路径校验、敏感路径阻断、鉴权、日志

---

## 6. 工具发现与提示注入

### 6.1 目标

模型必须先知道当前可用工具，才能稳定调用。

### 6.2 Live MCP Catalog Prompt

userscript 基于 `/tools` 动态生成一份 live catalog prompt，并在 ChatGPT 会话请求发出前透明注入；面板里的复制/插入按钮只作为诊断和兜底。prompt 至少包含：

- 当前 enabled 工具列表
- 每个工具的名称、说明、风险等级
- 每个工具的示例 `mcp` JSON block
- `mcp_list` 的示例调用
- 基本规则：只用相对 `workspaceRoot` 路径、只调用 enabled 工具、可一次输出多个 `mcp` block

### 6.3 注入策略

- 默认策略是请求层透明注入，而不是把 catalog 作为一条可见消息塞进聊天框。
- 只匹配 ChatGPT 会话请求接口，不改写其他页面请求。
- 每次用户发送消息时都可重新注入 live catalog，避免工具目录、开关状态或 enabled 状态变化后模型拿到旧信息。
- 如果请求体结构无法识别，允许退回面板复制/插入 catalog 的手动路径。

### 6.4 `mcp_list`

Gateway 必须提供低风险只读工具 `mcp_list`，作用是：

- 让模型在会话中自行刷新目录
- 让模型看到当前工具的 `enabled` 状态
- 让模型拿到每个工具的 `exampleArgs`
- `tools` 返回中必须包含 `mcp_list` 自身，避免 prompt 目录、`/tools`、以及 `mcp_list` 结果之间出现统计不一致

### 6.5 输出格式

统一使用 fenced `mcp` JSON block：

````markdown
```mcp
{
  "tool": "read_file",
  "args": {
    "path": "README.md"
  }
}
```
````

不支持自由文本缩写调用。

---

## 7. 工具执行模型

### 7.1 三个独立自动化开关

v0.1 定义三个独立开关：

- `autoExecuteLowRisk`
- `autoInsertResult`
- `autoSendResult`

三者彼此独立，默认值全部为 `true`。

### 7.2 默认 happy path

当三个开关都开启时，默认流程为：

```text
检测到 enabled 低风险工具
→ 自动执行
→ 自动插入结果
→ 自动发送
```

### 7.3 开关语义

| 开关 | 开启时 | 关闭时 |
|---|---|---|
| `autoExecuteLowRisk` | 自动执行 enabled 低风险工具 | 保留待执行状态，用户手动点 `Run` / `Run All` |
| `autoInsertResult` | 工具完成后自动插入输入框 | 停留在 `result_ready`，用户手动点 `Insert result` 或 `Copy result` |
| `autoSendResult` | 结果插入后自动发送 | 停留在 `inserted`，用户手动点页面发送按钮 |

无论工具成功还是失败，只要已经生成结构化 `tool_result` / `tool_result_batch`，都必须继续遵守 `autoInsertResult` 与 `autoSendResult` 的当前值。

### 7.4 Batch 规则

同一条 assistant 回复中出现多个合法 `mcp` block 时：

- 按出现顺序串行执行
- 任意时刻最多一个 in-flight 调用
- 默认在任一项失败后立即停止
- userscript 额外提供一个本地开关 `continueBatchOnError`，默认关闭
- 当 `continueBatchOnError` 开启时，已进入执行链路的后续项继续串行执行，不再自动标记为 `skipped`
- 统一回填一次 `tool_result_batch`
- 结果中必须包含 completed / failed / skipped

`tool_result_batch` 的回填结构以当前实际 userscript 输出为准：

```json
{
  "type": "tool_result_batch",
  "ok": false,
  "batchId": "sha256...",
  "source": {
    "messageId": "assistant-message-id"
  },
  "summary": {
    "total": 3,
    "completed": 1,
    "failed": 1,
    "skipped": 1,
    "stoppedOnFailure": true
  },
  "items": [
    {
      "index": 0,
      "tool": "list_directory",
      "callId": "call-1",
      "ok": true,
      "result": {},
      "warnings": [],
      "durationMs": 42
    },
    {
      "index": 1,
      "tool": "read_file",
      "callId": "call-2",
      "ok": false,
      "error": {
        "code": "BLOCKED_PATH",
        "message": "The requested path is blocked by security policy."
      },
      "warnings": [],
      "durationMs": 5
    },
    {
      "index": 2,
      "tool": "grep_files",
      "callId": "call-3",
      "status": "skipped",
      "reason": "SKIPPED_AFTER_BATCH_FAILURE"
    }
  ],
  "warnings": []
}
```

### 7.5 `maxToolRounds`

- `maxToolRounds` 用于限制同一用户请求触发的自动工具回合数，避免 assistant → `tool_result` → assistant → `tool_result` 自动循环。
- 达到上限后，自动执行链路必须停止继续自动运行，并提示用户手动继续。
- 该限制只作用于自动执行链路，不应阻止用户手动 `Run` / `Run All`。
- v0.1 默认值为 `3`。

### 7.6 永久红线

即使开启自动化，也不得自动执行：

- `run_pwsh`
- `write_file`
- `write_file_proposal`
- 任意写文件工具
- 任意删除/清空/系统级工具

---

## 8. v0.1 工具面

### 8.1 默认提供

| 工具 | 风险 | 默认启用 | 自动执行资格 | 说明 |
|---|---|---:|---:|---|
| `mcp_list` | low | 是 | 是 | 返回当前工具目录和示例参数 |
| `read_file` | low | 是 | 是 | 读取 UTF-8 文本文件 |
| `list_directory` | low | 是 | 是 | 枚举目录内容 |
| `search_files` | low | 是 | 是 | 按文件名/路径搜索 |
| `grep_files` | low | 是 | 是 | 按文本内容搜索 |

`search_files` 的产品语义是“按相对路径做大小写不敏感的包含搜索”。实现上可优先利用 `rg` 做候选路径枚举和查询预过滤，但必须保留无 `rg` 时的 Node 降级路径，并确保两条路径的结果语义一致。

### 8.2 保留但默认禁用

| 工具 | 风险 | 默认启用 | 自动执行资格 | 说明 |
|---|---|---:|---:|---|
| `write_file` | high | 否 | 否 | 临时自举能力；需 `allowWrite=true`，仅支持 `replace` / `create` 文本写入 |
| `write_file_proposal` | medium | 否 | 否 | P1 能力，先生成 proposal |
| `run_pwsh` | high | 否 | 否 | P1 能力，必须确认 |

---

## 9. ChatGPT Web 适配要求

### 9.1 结果回填

userscript 必须优先写入当前可见的真实输入控件，而不是隐藏 fallback：

- 优先可见 `contenteditable`，例如 `#prompt-textarea`
- 其次可见 textarea
- 失败时退回剪贴板

### 9.2 发送按钮

ChatGPT 页面在输入框为空时可能显示语音按钮。userscript 必须：

- 在结果插入后等待真实 send button 状态出现
- 再尝试点击发送
- 不能因为仍处于语音按钮态就立即判定 “send button not found”

### 9.3 选择器治理

关键选择器必须集中维护，至少包括：

- assistant message
- code block
- editable input
- textarea
- send button

---

## 10. 安全模型

### 10.1 Trusted Local Mode

默认启用 `trustedLocalMode=true`。

含义：

- Gateway 只服务本机 `127.0.0.1`
- 在 trusted local mode 开启时，userscript 调用 `/tools`、`/call-tool` 默认不要求 token
- 只有用户主动关闭 trusted local mode，才退回 pairing token 模式
- trusted local mode 不是“任意网页都可信”，只是不再要求本机配对 token

### 10.2 Token 回退模式

当 `trustedLocalMode=false` 时：

- Gateway 启动时生成 token
- userscript 需要保存并发送 `X-CWMB-Token`
- token 仅用于本地配对，不暴露给页面 DOM

### 10.3 Workspace 边界

- 所有文件路径都必须限制在 `workspaceRoot`
- 禁止 `..` 逃逸
- 禁止绝对路径越界
- 禁止 symlink / realpath 绕出 workspace

### 10.4 敏感路径阻断

默认阻断至少包括：

- `.env`
- SSH key
- 浏览器用户数据目录
- Git credential 文件
- 各类 key / pem / pfx

### 10.5 高风险工具边界

- `run_pwsh` 默认禁用
- 写文件默认禁用
- Shell 永不进入自动执行链路
- 自动发送永不绑定高风险工具结果

### 10.6 日志

Gateway 记录调用日志，但不得记录：

- 完整敏感文件内容
- token
- secret-like value 原文
- 页面凭据

### 10.7 网页侧威胁模型

- userscript 只在 ChatGPT Web 页面注入，不在其他网页启用。
- 请求层注入只匹配 ChatGPT 会话请求，不改写其他请求。
- Gateway 即使开启 trusted local mode，也只接受 ChatGPT Web 的 `Origin`，并继续依赖请求结构校验和工具白名单限制执行面。
- 其他网页即使能探测 localhost 端口，也不应通过 origin 校验和工具白名单拿到任意本地执行能力。
- trusted local mode 的风险边界必须在 README 和面板里明确：它降低的是本机配对摩擦，不是放弃网页侧最小授权。

---

## 11. Gateway API

### 11.1 `GET /health`

返回：

- 服务在线状态
- 平台 / 端口 / shell
- `workspaceRoot`
- `trustedLocalMode`
- `autoExecuteLowRisk`
- `autoInsertResult`
- `autoSendResult`

### 11.2 `GET /tools`

返回工具目录。每个工具至少包含：

- `name`
- `title`
- `description`
- `risk`
- `enabled`
- `requiresConfirmation`
- `exampleArgs`

### 11.3 `POST /call-tool`

执行单个工具调用。

请求体：

```json
{
  "tool": "read_file",
  "args": {
    "path": "README.md"
  },
  "source": {
    "page": "chatgpt",
    "callId": "..."
  }
}
```

---

## 12. 默认配置

v0.1 默认配置基线：

```json
{
  "host": "127.0.0.1",
  "port": 8024,
  "workspaceRoot": "",
  "shell": "pwsh",
  "trustedLocalMode": true,
  "allowWrite": false,
  "allowPwsh": false,
  "autoExecuteLowRisk": true,
  "autoInsertResult": true,
  "autoSendResult": true,
  "maxToolRounds": 3
}
```

说明：

- `workspaceRoot` 缺失时，Gateway 启动阶段可以安全回填当前启动目录；如果仍为空，工具调用返回配置错误。
- `allowPwsh` 仅决定未来是否允许该工具暴露，不代表进入自动执行。
- `maxToolRounds` 仅用于限制自动工具回合数，不应阻止用户手动继续运行。

---

## 13. 错误处理

前端以结构化错误码为准，不依赖英文消息文本。

核心错误码至少包括：

| code | 含义 | 前端建议 |
|---|---|---|
| `WORKSPACE_NOT_CONFIGURED` | 未配置 workspace | 提示检查 `workspaceRoot` |
| `UNAUTHORIZED` | token 缺失或错误 | 提示检查 trusted local mode / token |
| `TOOL_DISABLED` | 工具存在但禁用 | 提示能力存在但当前不可执行 |
| `TOOL_NOT_FOUND` | 工具不存在 | 提示刷新目录或先调用 `mcp_list` |
| `PATH_OUTSIDE_WORKSPACE` | 路径越界 | 拒绝并提示安全边界 |
| `BLOCKED_PATH` | 命中敏感路径 | 拒绝并提示安全边界 |
| `FILE_TOO_LARGE` | 文件过大 | 提示改用搜索或缩小范围 |
| `BINARY_FILE_REJECTED` | 二进制文件拒绝读取 | 提示仅支持文本 |
| `PWSH_DISABLED` | Shell 未启用 | 提示默认禁用 |

---

## 14. 用户界面

### 14.1 面板最小能力

面板至少展示：

- Gateway 状态
- trusted local mode / token 状态
- 三个自动化开关的当前值
- `continueBatchOnError` 的当前值
- 当前检测到的工具或 batch
- 错误信息
- inspector 风格日志流
- 可折叠 / 展开
- 可拖动，并记住用户上次放置位置
- batch / result 的可展开详情
- `Insert MCP list`
- `Copy MCP list`
- `Run` / `Run All`
- `Insert result`
- `Copy result`

### 14.2 状态语义

至少包括：

- `disconnected`
- `unauthorized`
- `idle`
- `detected`
- `detected_batch`
- `executing`
- `batch_executing`
- `result_ready`
- `batch_result_ready`
- `inserted`
- `batch_inserted`
- `sent`
- `batch_sent`
- `failed`

---

## 15. README 对外口径

README 首页必须明确：

- 这是非官方本地工具桥
- 只服务 ChatGPT Web
- 默认 trusted local mode
- 默认三开关全自动，但仅针对 enabled 低风险工具
- 默认只读
- 不要把 `workspaceRoot` 指向整个用户目录或磁盘根目录
- `run_pwsh` 不属于 v0.1 默认执行面

建议对外定位文案：

> ChatGPT Web MCP Bridge is a security-first local tool bridge for ChatGPT Web on Windows + Chrome. It lets ChatGPT request read-only project context through structured MCP-style blocks, while keeping execution behind a local gateway, workspace restrictions, trusted local mode or pairing token, audit logs, and explicit tool boundaries.

---

## 16. v0.1 验收标准

### 16.1 产品语义验收

- ChatGPT Web 会话中默认通过请求层 live MCP catalog 注入知道当前工具目录；面板 `Insert MCP list` / `Copy MCP list` 只作为兜底路径。
- 模型能稳定输出 `mcp` JSON block。
- userscript 能检测并执行 enabled 低风险工具。
- 三个自动化开关都能独立生效。
- `continueBatchOnError` 开关默认关闭，并能独立控制 batch 失败后是否继续执行。
- 默认 happy path 为自动执行 + 自动插入 + 自动发送。
- 任一开关关闭后，退回对应手动路径。
- 工具失败后生成的结构化失败结果也遵守插入 / 发送开关。
- 同一 assistant 回复多 block 时，能统一回填符合 schema 的 `tool_result_batch`。

### 16.2 安全验收

- Gateway 只监听 `127.0.0.1`
- trusted local mode 默认开启
- workspace 外路径被拒绝
- `.env` 被拒绝
- disabled 工具不会被自动执行
- `run_pwsh` 不在默认执行面
- 非 ChatGPT Web 的 `Origin` 被拒绝

### 16.3 ChatGPT 页面验收

- 结果能写入当前真实输入框，而不是隐藏 fallback textarea
- 自动发送能等待 send button 出现
- `continueBatchOnError` 关闭时，batch 失败后后续项不执行并标记 `skipped`
- `continueBatchOnError` 开启时，batch 在失败后继续执行后续项并统一回填失败摘要
- 同一 assistant 回复多 block 只回填一次批量结果
- 自动工具回合达到 `maxToolRounds` 后停止自动循环并提示用户手动继续

### 16.4 工程验收

- `pnpm -r lint`
- `pnpm -r test`
- `pnpm -r build`

全部通过。

---

## 17. 后续版本方向

### P1

- `write_file_proposal`
- 受限 `run_pwsh`
- 更细的确认 UI
- `/settings` 持久化设置

### P2

- Chrome Extension 正式形态
- 更丰富的 MCP adapter
- 更强的审计与策略配置

---

## 18. 最终结论

v0.1 的正确产品定义不是“通用网页 AI 工具平台”，而是：

> 一个只服务 ChatGPT Web、面向 Windows 本地开发工作流、默认只读、默认三开关全自动、但安全边界清晰的本地工具桥。

这份 PRD 以该定义为唯一真相。
