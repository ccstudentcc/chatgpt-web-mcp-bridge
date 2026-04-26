# Current Scope Spec

## Goal

Close two remaining v0.1 usability gaps in the browser flow: teach ChatGPT which MCP tools are currently available, and make result insertion / auto-send work against the current ChatGPT composer DOM.

## In Scope

- Expose MCP tool examples from the gateway tool catalog and add an `mcp_list` tool for in-chat discovery.
- Let the userscript generate a current MCP catalog prompt from live `/tools` data, inject it into outgoing ChatGPT conversation requests by default, and keep insert/copy actions as fallback diagnostics.
- Fix result insertion so the userscript targets the visible `contenteditable` composer instead of hidden fallback textareas, then waits for the real send button state.
- Refresh PRD, README, and task-control docs to reflect the new discovery flow and current DOM assumptions.
- Ensure the repository-level lint, test, and build entrypoints all pass after the change.

## Out of Scope

- Windows + Chrome live acceptance in a real signed-in browser session.
- P1 or later features such as `write_file_proposal`, `run_pwsh`, `apply_proposal`, or dynamic `/settings`.
- Chrome extension migration or stdio MCP adapter work.

## Constraints

- Keep the automation scope limited to gateway-enabled v0.1 tools; disabled tools may be discoverable but must stay non-runnable.
- Preserve the existing batch failure rule: stop on first failure, then send one consolidated batch result.
- Treat the PRD as the authority for product semantics and keep `AGENTS.md` focused on execution rules.
- Keep verification reproducible from the repo root.

## Acceptance Criteria

- Gateway `/tools` and `mcp_list` expose current tool metadata with runnable state and example arguments.
- Userscript injects the live MCP catalog prompt into outgoing ChatGPT conversation requests by default, while `Insert MCP list` / `Copy MCP list` remain fallback diagnostics.
- Userscript result insertion targets the real visible composer and auto-send can find the current send button after insertion.
- Batch execution stops on first failure and returns one consolidated `tool_result_batch`, including skipped items after the first failure.
- Root `pnpm -r lint`, `pnpm -r test`, and `pnpm -r build` all succeed.
- Remaining work, if any, is limited to live manual acceptance rather than missing code-level v0.1 functionality.
