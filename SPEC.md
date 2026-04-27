# Current Scope Spec

## Goal

Close the remaining v0.1 browser usability gaps around the userscript panel: keep live MCP discovery and real composer insertion working, while making automation controls, batch-failure behavior, and runtime inspection legible on the current ChatGPT Web UI.

## In Scope

- Expose MCP tool examples from the gateway tool catalog and add an `mcp_list` tool for in-chat discovery.
- Keep `/tools`, injected prompt hints, and `mcp_list` responses aligned on the same live catalog counts and metadata.
- Let the userscript generate a current MCP catalog prompt from live `/tools` data, inject it into outgoing ChatGPT conversation requests by default, and keep insert/copy actions as fallback diagnostics.
- Bootstrap the request-hook prompt from the last successful tool catalog snapshot so a new chat's first user turn does not wait on the current page's async gateway sync.
- Make the injected catalog prompt explicit that local workspace file tasks should prefer the Local MCP Bridge over unrelated native connectors, and surface request-hook diagnostics in the panel log.
- Add a local request-injection mode switch so synthetic `system` message insertion can be A/B tested against prepend-user injection without rebuilding the script each time.
- After the experiment validates synthetic `system` injection, remove prepend-user switching from the main UI and keep it only as a hidden fallback path.
- Fix result insertion so the userscript targets the visible `contenteditable` composer instead of hidden fallback textareas, then waits for the real send button state.
- Make the panel collapsible and more inspector-like, with expandable batch/result details plus an activity log stream.
- Ensure the `Execute`, `Insert`, and `Send` automation controls behave as true local overrides rather than passive status labels.
- Add a gated high-risk `write_file` tool that stays disabled until `allowWrite=true` and remains manual-only even when enabled.
- Add a userscript-local `Continue on error` toggle for batch execution, defaulting to fail-stop.
- Enforce `maxToolRounds` for automatic tool execution without blocking manual `Run` / `Run All`.
- Make structured failure results follow the same insert/send automation path as success results.
- Refresh PRD, README, and task-control docs to reflect the new discovery flow and current DOM assumptions.
- Ensure the repository-level lint, test, and build entrypoints all pass after the change.

## Out of Scope

- Windows + Chrome live acceptance in a real signed-in browser session.
- P1 or later features such as `write_file_proposal`, `run_pwsh`, `apply_proposal`, or dynamic `/settings`.
- Chrome extension migration or stdio MCP adapter work.

## Constraints

- Keep the automation scope limited to gateway-enabled v0.1 tools; disabled tools may be discoverable but must stay non-runnable.
- Treat the PRD as the authority for product semantics and keep `AGENTS.md` focused on execution rules.
- Keep verification reproducible from the repo root.

## Acceptance Criteria

- Gateway `/tools` and `mcp_list` expose the same current tool metadata with runnable state and example arguments, including `mcp_list` itself.
- `write_file` is present as a high-risk tool, stays disabled by default, becomes enabled only with `allowWrite=true`, and remains outside the automatic execution path.
- Userscript injects the live MCP catalog prompt into outgoing ChatGPT conversation requests by default, while `Insert MCP list` / `Copy MCP list` remain fallback diagnostics.
- Whenever an assistant reply is issuing MCP tool calls, that reply contains only fenced `mcp` blocks with no prose, raw JSON outside fences, or intermediate reasoning text.
- The injected prompt makes it explicit that this bridge is not native MCP: an `mcp` block only requests execution, and the model must wait for a later bridge-inserted `tool_result` or `tool_result_batch` message before continuing.
- The injected prompt makes the storage boundary explicit: bridge tools operate on the host repository configured as `workspaceRoot`, not ChatGPT sandbox paths such as `/mnt/data`.
- If ChatGPT emits a mixed reply instead, the userscript blocks execution, does not queue pending tools from that turn, and surfaces an explicit invalid-turn error in the panel.
- When a reply contains a valid fenced/rendered MCP block plus separate unfenced MCP-like JSON noise but no prose, the userscript recovers by using only the valid MCP block and logging a warning.
- After at least one successful gateway sync, a later page load can still inject the catalog into the first outgoing chat request before the fresh `/tools` refresh finishes.
- The panel activity log distinguishes between successful request injection, prompt-not-ready races, and matched-but-unpatched request bodies so manual troubleshooting can identify why ChatGPT missed the catalog.
- Automatic request injection now uses a short bootstrap prompt; the full tool catalog remains a manual diagnostics fallback.
- The main UI should show the current injection mode as read-only runtime status, not expose prepend-user as a normal daily toggle.
- Userscript result insertion targets the real visible composer and auto-send can find the current send button after insertion.
- The userscript panel can collapse, shows activity logs, and exposes expandable batch/result details.
- The `Execute`, `Insert`, and `Send` controls all change runtime behavior immediately for later detections/results.
- Automatic tool execution stops after `maxToolRounds` for the current detected user request and leaves manual `Run` / `Run All` available.
- With `Continue on error` off, batch execution stops on first failure and returns one consolidated `tool_result_batch`, including skipped items after the first failure.
- With `Continue on error` on, later tools still run after one batch item fails and the consolidated batch result reports failed items without synthetic skips.
- Structured single-tool and batch failure results still follow the current insert/send automation toggles.
- Root `pnpm -r lint`, `pnpm -r test`, and `pnpm -r build` all succeed.
- Remaining work, if any, is limited to live manual acceptance rather than missing code-level v0.1 functionality.
