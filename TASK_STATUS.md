# Task Status

## Current Truth

- The repository now appears code-complete for the documented v0.1 browser-to-gateway flow.
- The userscript now consumes gateway automation flags, auto-executes enabled tools, auto-inserts results, and auto-sends them by default while still gating execution on live `/tools` capabilities.
- Updating the token or Gateway base URL in the panel now re-syncs gateway health and `/tools` capabilities immediately, so executable actions do not stay hidden until the next poll.
- The userscript now parses rendered ChatGPT code blocks from the real DOM instead of relying only on fenced markdown text, so automatic execution can start from actual ChatGPT replies where triple backticks are no longer visible.
- The userscript now scans the current page once at startup, so an MCP block that is already rendered before the observer attaches still becomes runnable without waiting for a later DOM mutation.
- Single-tool deduplication is now scoped to the current assistant message identity instead of only the raw JSON body, so the same MCP request can appear again in a new conversation without being suppressed as already executed.
- Repository-level `lint`, `test`, and `build` entrypoints now pass across the workspace.

## Latest Verified Evidence

- `pnpm --filter @cwmb/protocol build` succeeded.
- `pnpm --filter @cwmb/userscript lint` succeeded.
- `pnpm --filter @cwmb/userscript test` succeeded with 5 passing files and 17 passing tests.
- `pnpm --filter @cwmb/userscript build` succeeded.
- `pnpm -r lint` succeeded.
- `pnpm -r test` succeeded across protocol, shared, gateway, and userscript.
- `pnpm -r build` succeeded across protocol, shared, gateway, and userscript.

## Stop Line

- Remaining work is no longer an obvious code-side PRD gap.
- The next acceptance step is live manual validation in a real ChatGPT Web session with a running local gateway, especially for DOM detection, capability-gated panel behavior, and result insertion on the actual page.

## Caveats

- This repo still lacks browser-driven end-to-end automation, so the final v0.1 claim depends on manual live acceptance rather than only unit and build checks.
- Optional or later-scope PRD items remain intentionally out of scope: dynamic `/settings`, `/logs` endpoint work, `write_file_proposal`, `run_pwsh`, `apply_proposal`, and Chrome extension migration.
