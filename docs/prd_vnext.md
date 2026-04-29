# ChatGPT Web Local Agent Bridge PRD vNext

## 0. 文档信息

- 产品名称：ChatGPT Web Local Agent Bridge
- 当前文档：vNext PRD / 产品边界版
- 文件名：`docs/prd_vnext.md`
- v0.9 入口：`docs/v0.9-entrypoint.md`
- v0.1 参考基线：`docs/prd.md`
- 目标架构真相：`docs/architecture/v0.9-target-architecture.md`
- 适用范围：定义最终版产品边界、能力模型、默认取舍与非目标

本文不再承担模块设计、协议细节、迁移顺序或 Codex 施工纪律。进入 v0.9 文档包时，先读 `docs/v0.9-entrypoint.md`，再按入口跳到对应子文档。那些内容已经迁移到：

- `docs/architecture/*`
- `docs/protocols/*`
- `docs/operations/*`

---

## 1. 一句话定义

ChatGPT Web Local Agent Bridge 是一个只服务 ChatGPT Web 的本地开发工作流增强器：它让 ChatGPT 在受控边界内读取本地仓库、执行本地开发动作、生成或直接落地修改，并通过模式、策略、审计和诊断保持用户控制。

---

## 2. 产品边界

### 2.1 只做 ChatGPT

vNext 明确只做 ChatGPT Web，不以多平台兼容为近期目标。

原因不是抽象上的“先聚焦”，而是产品价值本身依赖对 ChatGPT Web 真实运行时的深度适配：

- hidden request-layer injection
- assistant tool turn 检测
- invalid-turn 阻断
- startup/history rescan
- result insertion / auto-send
- 页面漂移后的恢复与诊断

如果为多平台抽象过早牺牲这些链路，系统会重新退化成“泛化但不稳”的桥接器。

### 2.2 不做会话管理主线

vNext 不把会话管理作为主产品线。

不做的内容包括：

- 对话归档/分类/标签
- ChatGPT 历史管理产品化
- 会话批量操作
- 依赖平台内部 API 的会话增强

这类能力以后即使存在，也只能是次级附加层，不能反客为主定义系统主架构。

### 2.3 最终浏览器壳

最终浏览器壳是 Chrome Extension。

当前 userscript 已经降级为归档 reference baseline，保存在 `apps/userscript/legacy/` 供回看，不再是 workspace app，也不是受支持的运行时路径。

### 2.4 操作面分工

最终产品不是只靠一个扩展入口承载全部交互。

Phase 2.5 之后的正式取舍是：

- ChatGPT 页面内面板是主操作面
- `popup` 是轻量补充入口
- `options` 是完整控制台

其中：

- 页面内面板负责会话本地的执行、插回、恢复、运行时诊断和即时操作
- `popup` 负责快速查看桥接状态、健康摘要和高频入口
- `options` 负责完整设置、连接状态、catalog 概览、日志/诊断摘要和全局控制台能力

### 2.5 配置真相与运行时真相分离

最终产品明确区分两类真相：

- background/service worker 持有扩展级配置真相
- ChatGPT 页面运行时持有会话级运行时真相

这不是实现细节，而是产品交互边界本身的一部分。

含义是：

- `popup` 和 `options` 可以稳定地查看和修改全局配置
- 页面内面板继续作为主运行时控制面
- 非页面入口不会伪装成新的会话执行架构

---

## 3. 当前真相与未来目标的关系

`docs/prd.md` 记录的是已验证可用、并于 April 27, 2026 关闭 stop line 的 v0.1 reference baseline。只要某项运行时行为仍然由当前代码承担，vNext 设计就必须显式尊重它，直到有批准的迁移方案替换它。

当前必须继承的关键真相包括：

- 当前主路径是 hidden request-layer injection
- 当前 live catalog truth 来自 `/tools`
- 当前 canonical gateway route set 是 `/health`、`/tools`、`/call-tool`
- 当前 `mcp_list`、visible/hidden 注入 prompt、共享 tool guidance、catalog truth 必须对齐
- 当前非原生 MCP 边界必须保留
- 当前 invalid-turn enforcement 必须保留
- 当前 startup/history rescan 规则必须保留
- 当前 execute / insert / send 自动化开关语义必须保留

vNext 不是用未来设想覆盖这些事实，而是在不丢失它们的前提下定义最终产品。

这里的“继承”指行为继承，不是代码形态继承。

- userscript 提供的是已验证行为参考
- extension + gateway 才是 v0.9 的正式实现落点
- 当直接在 extension / gateway 重写或重组逻辑更利于效率、时序和边界清晰时，优先走直接重构，而不是为了“照抄 userscript”去维持一条人为 compat 路线

---

## 4. 核心产品目标

### 4.1 目标不是“能调工具”

v0.1 已经证明了 ChatGPT Web 调本地工具这件事本身成立。vNext 的目标不是重复证明这一点，而是把它做成稳定、强力、可恢复、可持续推进的本地开发工作流入口。

### 4.2 最终目标能力

最终版要解决的不是单点工具调用，而是完整的本地开发闭环：

```text
读仓库
→ 搜索上下文
→ 理解问题
→ 产生修改或执行动作
→ 回读结果
→ 继续下一轮
```

这条闭环既要能走保守路径，也要能走高自治路径。

### 4.3 关键卖点

1. ChatGPT Web 深度适配，而不是抽象多站点 demo。
2. builtin local workflow tools 足够强，不依赖一切都退化为 shell。
3. 同时支持保守模式与高自治模式，而不是只有 proposal-only 或全放开。
4. Local Gateway 是真实的执行与安全边界，而不是临时 server。
5. 诊断、恢复、审计是正式产品能力，而不是附属调试能力。

---

## 5. 执行模式

vNext 明确采用双模式执行模型：

- `reviewed`
- `yolo`

### 5.1 `reviewed`

`reviewed` 是 operator-mediated mode。

含义：

- 重要副作用默认不自动落地
- proposal、confirm、manual approve 是正式流程的一部分
- 系统优先保守、可审查、可复核

### 5.2 `yolo`

`yolo` 是 high-autonomy mode under workspace hard limits。

含义：

- 允许更强的直接执行
- 允许更高的连续推进效率
- 仍然不能突破 workspace hard policy
- 仍然不能把所有工具级策略一笔抹掉

### 5.3 两者都不是 UI 开关玩具

它们是正式产品能力，不是装饰性状态标签。

它们决定的是：

- 哪些动作可直接执行
- 哪些动作转 proposal
- 哪些动作必须 confirm
- 哪些动作始终 deny

---

## 6. 能力模型

### 6.1 三层能力面

最终产品能力分成三层：

1. `builtin local workflow tools`
2. `run_pwsh` power-tool plane
3. `external/custom MCP` extension plane

### 6.2 Builtin 是主线

最终产品不应停留在“少量只读工具 + shell 逃生口”。

builtin 至少要覆盖高频本地开发动作：

- 文件读取
- 搜索与 grep
- 基础编辑/写入
- 基础 git 状态与 diff
- 基础 task/workflow 动作
- bridge/meta 能力

### 6.3 `run_task` 与 `run_pwsh`

两者都保留，但定位不同。

`run_task`：

- 面向高频、稳定、结构化的工作流动作
- 例如 `lint`、`test`、`build`、常见 repo 任务

`run_pwsh`：

- 正式目标能力，不再只是边缘占位
- 但它属于 power-tool plane，而不是默认第一选择
- 适合低频、组合式、环境相关、repo 特定脚本场景

产品取舍是：

- 高频稳定动作优先 builtin 或 `run_task`
- 复杂临时动作交给 `run_pwsh`
- 不让 shell 反向吞掉主能力面

### 6.4 External / Custom MCP

external/custom MCP 是最终版的重要扩展面，但不是主能力面。

默认取舍：

- builtin 先做强
- external MCP 用来补个性化或生态接入
- external tool 默认比 builtin 更保守
- external tool 不得绕开统一策略、审计和结果模型

---

## 7. 写入与副作用策略

vNext 不采用单一路线。

### 7.1 不走 proposal-only

最终产品不应强制所有写入都只能 proposal。

### 7.2 也不走无条件 direct-write

最终产品也不应把所有写入都降格为直接落盘。

### 7.3 正式取舍

最终写入策略是：

- `reviewed` 下优先走 proposal / confirm / apply
- `yolo` 下允许更多 direct execution
- 两者共享同一套工具能力面和统一 policy system

也就是说，proposal 是正式主路径之一，但不是唯一世界观。

---

## 8. 安全与控制边界

### 8.1 Local Gateway 是正式安全边界

最终产品必须继续把 Local Gateway 当成真实边界：

- localhost-only
- Origin 限制
- CORS allowlist
- trusted local mode / token fallback
- workspace hard policy
- 审计与脱敏 diagnostics

### 8.2 trusted local mode 不是“信任任意网页”

它只是降低本机配对摩擦，不代表放弃网页侧最小授权和 origin 边界。

### 8.3 模式不是安全边界本身

`reviewed` / `yolo` 是执行模式，不是安全边界本身。

真正的边界仍是：

- workspace hard policy
- gateway policy
- tool-level envelope
- audit / diagnostics

---

## 9. 诊断与恢复

诊断和恢复不是附加功能，而是正式产品能力。

最终产品必须能让用户明确知道：

- catalog 是否成功进入模型上下文
- assistant turn 为什么被判 invalid
- 为什么没有执行
- 为什么结果没插回去
- gateway 是否在线
- 当前模式与工具策略是什么
- 下一步恢复动作是什么

最重要的产品原则是：

> fallback 是主架构的恢复分支，不是第二套系统。

---

## 10. 非目标

vNext 明确不把以下方向作为主产品范围：

- 多平台适配主线
- 会话管理主线
- 读取 ChatGPT token / Cookie / localStorage
- 默认自动执行远端 MCP
- 默认高权限浏览器能力
- Store / marketplace / monetization
- remote config / analytics

---

## 11. 文档分工

本文只定义产品边界、能力模型和默认取舍。

这些内容不再由本文承担：

- 模块树与依赖方向 -> `docs/architecture/*`
- 协议字段与不变式 -> `docs/protocols/*`
- gateway/security/tool-policy/troubleshooting -> `docs/operations/*`
- 当前行为真相 -> `docs/prd.md`
- 当前活动主线与阶段门 -> `SPEC.md` / `IMPLEMENTATION_PLAN.md` / `TASK_STATUS.md`

---

## 12. 结论

vNext 的真正方向不是：

- 继续长成一个更大的 userscript
- 做成多平台工具桥
- 把 proposal-only 当成唯一产品哲学
- 或者把所有灵活性都交给 shell

而是：

> 只服务 ChatGPT Web，围绕本地开发工作流，做一个 builtin-first、双模式、可审计、可恢复、可高自治推进的本地 agent bridge。

最终产品必须同时具备：

- ChatGPT Web 深度适配
- 强 builtin 能力面
- 正式的 `run_pwsh` power-tool plane
- external/custom MCP 扩展面
- `reviewed` / `yolo` 双模式
- 真实的 gateway 安全与诊断边界

这才是最终版应当达到的产品形态。
