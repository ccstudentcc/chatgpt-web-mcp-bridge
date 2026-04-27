# Gateway

## 0. Document Status

- Status: draft v2
- Scope: gateway role, current live contracts, and operator-facing checks

## 1. Purpose

The gateway is the local execution kernel and contract host. It is not the ChatGPT page runtime.

## 2. What The Gateway Actually Owns Today

The gateway owns:

- the live route surface: `/health`, `/tools`, and `/call-tool`
- materialized catalog truth for the current builtin tool set
- builtin tool execution for the current shipped v0.1 tools
- localhost/origin/token/trusted-local access control
- workspace and sensitive-path enforcement
- execution logging and basic diagnostics for current tool calls

The gateway does not own:

- ChatGPT DOM selectors
- page turn detection
- result insertion into the composer
- conversation-local runtime UI state

Target-state docs may assign proposal handling, richer shell flows, external MCP lifecycle, or result-cache subsystems to the gateway in the future, but those are not current shipped gateway subsystems yet.

## 3. Current Live Routes And What They Mean

Current shipped v0.1 runtime truth still depends on these routes:

- `/health`: gateway reachability, config-derived runtime status, and operator-visible health summary
- `/tools`: canonical live catalog truth used by hidden injection, panel capability display, and `mcp_list` alignment
- `/call-tool`: canonical live execution route for the current userscript flow

Operational rule:

- if `/health` fails, treat the problem as a gateway reachability or auth/origin issue first
- if `/health` works but `/tools` is wrong, treat the problem as catalog/config truth first
- if `/tools` is right but execution surprises you, inspect `/call-tool` semantics, policy, and browser-side turn detection separately

## 4. Current Canonical Contract Reality

At the current repo stage:

- the current shipped live gateway route set is `/health`, `/tools`, and `/call-tool`
- `/tools` remains the canonical live catalog contract
- `/call-tool` remains the canonical live execution route
- `/health` remains the canonical live health and gateway-status route
- browser runtimes may aggregate validated `/health` and `/tools` into one local runtime snapshot, but that snapshot is not a new route contract
- route renaming must not silently demote live runtime dependencies
- any future logical rename must use an approved migration plan

Refactor rule:

- none of `/health`, `/tools`, or `/call-tool` may be silently renamed, merged away, or degraded during structural work
- any future logical target names such as `/catalog` or `/execute` must coexist behind an approved migration path before the current live routes stop being canonical

## 5. Fast Gateway Checks

Use this order before assuming a refactor or browser bug:

1. `/health` returns the expected host, port, workspace, and automation baseline.
2. `/tools` includes the expected enabled tools and still includes `mcp_list` itself.
3. If the operator expects write capability, confirm `allowWrite=true` was actually applied before assuming `write_file` is missing.
4. If the operator expects a token, confirm trusted local mode is really off; otherwise token prompts are a workflow mismatch, not a runtime failure.
5. If a page-side symptom remains after `/health` and `/tools` look correct, move the investigation to request injection, turn detection, or result delivery rather than continuing to blame the gateway.

## 6. Current Security-Critical Gateway Baseline

Gateway refactors must preserve the current shipped baseline from `docs/prd.md`:

- localhost-only binding
- ChatGPT Web `Origin` restrictions
- trusted local mode semantics
- token mode fallback when trusted local mode is disabled

Trusted local mode does not mean arbitrary webpages are trusted. It only removes the local pairing-token requirement for the intended ChatGPT Web origin path; it does not relax host binding, origin checks, or conservative execution boundaries.

## 7. Boundary Between Gateway Trouble And Browser Trouble

Treat it as a gateway-side problem when:

- `/health` is unreachable or inconsistent with local config
- `/tools` omits or misstates live capability truth
- `/call-tool` returns an execution result or error code that contradicts the catalog or config

Treat it as a browser-runtime problem when:

- `/health` and `/tools` are healthy but ChatGPT never emitted an MCP turn
- the activity log shows prompt injection races or matched-but-unpatched request bodies
- execution completed but insert/send failed in the page

## 8. Target Direction

Target gateway structure:

- `api`
- `execution-kernel`
- `tool-registry`
- `tool-policy`
- `builtin-tools`
- `proposal-engine`
- `shell-runtime`
- `external-mcp`
- `result-cache`
- `audit-log`
- `diagnostics`

## 9. Related Documents

- [../prd.md](../prd.md)
- [../v0.9-entrypoint.md](../v0.9-entrypoint.md)
- [../architecture/gateway-kernel.md](../architecture/gateway-kernel.md)
- [../protocols/catalog-contract.md](../protocols/catalog-contract.md)
- [../protocols/gateway-runtime-contract.md](../protocols/gateway-runtime-contract.md)
- [../protocols/execution-contract.md](../protocols/execution-contract.md)
