# Troubleshooting

## 0. Document Status

- Status: draft v3
- Scope: current operator-facing troubleshooting flow for the proven runtime baseline, plus guardrails for reading v0.9 docs without misdiagnosing current behavior

Current runtime-baseline truth still lives in [../prd.md](../prd.md). Current active product-target truth lives in [../prd_vnext.md](../prd_vnext.md) plus the root task-control docs. This document is the practical "what do I check next" entrypoint.

For raw ChatGPT Web DOM/request-shape/selectors evidence, use [chatgpt-web-runtime-evidence.md](./chatgpt-web-runtime-evidence.md) as the single source of truth rather than duplicating observations here. For the canonical v0.9 code owner of those facts, use `apps/extension/src/chatgpt-adapter/`.

## 1. Fast Triage Order

Run these checks in order before diving into deeper theory:

1. Confirm the gateway is reachable through `/health`.
2. Confirm `/tools` returns the expected live catalog, including `mcp_list`.
3. Check the active browser-runtime activity log:
   - extension content-script panel when Stage 19+ extension path is in use,
   - userscript panel when validating the fallback compat path.
   Use it to see whether the outgoing ChatGPT request was injected, raced the prompt bootstrap, or matched a body shape the hook did not patch.
4. Inspect the latest assistant turn shape:
   - no MCP block emitted,
   - valid MCP block emitted,
   - mixed reply blocked as `invalid_mcp_turn`,
   - or an older closed turn was rediscovered on refresh.
5. If a tool did run, inspect result delivery separately:
   - execution,
   - insert into the visible composer,
   - send button readiness,
   - auto-send outcome.
6. Only after the above is clear, classify the problem as gateway, policy, security, or browser-runtime drift.

If the hidden request-layer path is suspect, use `Insert MCP list` or `Copy MCP list` as the manual fallback. Do not treat that fallback as proof that the hidden path is healthy.

## 2. Symptom Index

### Gateway looks disconnected

Check first:

- `/health` reachability
- Gateway base URL in the panel
- whether trusted local mode or token mode matches the operator's expectation

Likely causes:

- gateway not running
- wrong base URL
- localhost reachability problem
- origin/auth rejection

Then read:

- [gateway.md](./gateway.md)
- [security.md](./security.md)

### ChatGPT replied, but no MCP block appeared

Check first:

- active browser-runtime activity log for injection success vs prompt-not-ready race vs matched-but-unpatched request body
- whether the ask was a simple local-file request that should have triggered the hidden contract directly
- whether the model fell back to unrelated native connectors instead of bridge tools

Likely causes:

- hidden injection missed the real request
- first-turn bootstrap cache was unavailable or stale
- ChatGPT ignored the hidden prompt
- the ask was underspecified enough that the model chose prose instead of tools

Then read:

- [../prd.md](../prd.md)
- [chatgpt-web-runtime-evidence.md](./chatgpt-web-runtime-evidence.md)
- [../protocols/catalog-contract.md](../protocols/catalog-contract.md)

### MCP block appeared, but execution was blocked as `invalid_mcp_turn`

Check first:

- whether natural language, analysis, or raw unfenced JSON appeared after the first fenced `mcp` block
- whether the only trailing residue was a short ChatGPT thinking/status label
- whether the reply contained one valid fenced `mcp` block plus separate unfenced MCP-like JSON noise without prose

Current rule:

- brief natural-language context before the first fenced `mcp` block is allowed
- prose or reasoning mixed into the tool-call turn is a hard block once the first fenced `mcp` block has appeared
- a short UI thinking/status residue before the first fenced `mcp` block is recoverable with a warning
- a short UI thinking/status residue is recoverable with a warning
- unfenced MCP-like JSON noise without prose is recoverable only if a valid fenced `mcp` block is already present

Then read:

- [../prd.md](../prd.md)
- [chatgpt-web-runtime-evidence.md](./chatgpt-web-runtime-evidence.md)
- [../protocols/execution-contract.md](../protocols/execution-contract.md)

### Refresh or startup did not recover the expected open MCP turn

Check first:

- whether a later bridge `tool_result` or `tool_result_batch` already closed the older assistant turn
- whether the latest assistant node is only an empty shell or a thinking-only placeholder
- whether the page is replaying stale history instead of the newest substantive assistant turn

Current rule:

- only the latest still-open assistant MCP turn is eligible
- closed historical turns must not re-execute
- empty or thinking-only trailing assistant nodes should be skipped

Then read:

- [../prd.md](../prd.md)
- [chatgpt-web-runtime-evidence.md](./chatgpt-web-runtime-evidence.md)
- [../protocols/execution-contract.md](../protocols/execution-contract.md)

### Tool executed, but result was not inserted or not sent

Check first:

- whether `Auto insert` or `Auto send` was turned off locally
- whether insertion targeted the visible composer rather than a hidden fallback textarea
- whether the send button became ready after insertion
- whether the inserted payload contained embedded fences that required a longer outer fence

Likely causes:

- local runtime override disabled insertion or sending
- ChatGPT DOM drift changed the visible composer or send button path
- the composer did not settle before send readiness was checked

Then read:

- [../prd.md](../prd.md)
- [chatgpt-web-runtime-evidence.md](./chatgpt-web-runtime-evidence.md)
- [gateway.md](./gateway.md)

### Tool call was denied, required confirmation, or did not show as runnable

Check first:

- tool risk and enablement in `/tools`
- `allowWrite` and other gateway config expectations
- whether the operator is reading a v0.9 target-state doc as if it were current shipped behavior

Current v0.1 reminders:

- `write_file` is optional, disabled by default, and manual-only even when enabled
- `run_pwsh` is not a shipped v0.1 capability
- target-state `reviewed` / `yolo` language exists in planning docs, not as a fully shipped live mode system

Then read:

- [tool-policy.md](./tool-policy.md)
- [security.md](./security.md)
- [../v0.9-entrypoint.md](../v0.9-entrypoint.md)

## 3. Current Baseline Focus

The v0.1 stop line was formally closed on April 27, 2026. That means these items are no longer open acceptance blockers by default.

They still remain the most important real-world behaviors to preserve or re-prove whenever the runtime changes:

- hidden request-layer injection on the real ChatGPT page
- first-turn bootstrap behavior with and without a warm cached catalog
- actual MCP block emission by ChatGPT under the hidden contract
- end-to-end execute/insert/send behavior on the live page

If these regress during v0.9 work, prefer real-page evidence over unit-test confidence.

## 4. When To Escalate From Current Docs To v0.9 Planning Docs

Stay in current-operation docs when the question is:

- why did today's local bridge run fail,
- which live route or runtime rule is canonical,
- what does the proven runtime baseline still do today.

Switch to [../v0.9-entrypoint.md](../v0.9-entrypoint.md) only when the question is:

- where should the now-active extension/gateway split land next,
- which target modules should own a capability later,
- which active v0.9 slice should own the next implementation work.

## 5. Related Documents

- [../prd.md](../prd.md)
- [../v0.9-entrypoint.md](../v0.9-entrypoint.md)
- [gateway.md](./gateway.md)
- [security.md](./security.md)
- [tool-policy.md](./tool-policy.md)
- [chatgpt-web-runtime-evidence.md](./chatgpt-web-runtime-evidence.md)
- [../architecture/v0.9-target-architecture.md](../architecture/v0.9-target-architecture.md)
