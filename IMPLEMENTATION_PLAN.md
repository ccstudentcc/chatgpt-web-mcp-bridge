# Implementation Plan

## Stage 1: MCP Discovery Gap Review

Status: completed

- Re-read the PRD/UI flow and identify where ChatGPT still lacks live MCP tool discovery.
- Confirm that `/tools` is only used for capability gating today and does not teach the model what it can call.
- Keep batch failure semantics and live capability gating intact while adding catalog visibility.

## Stage 2: Tool Catalog Exposure And Injection

Status: completed

- Extend tool descriptors with example arguments.
- Add the low-risk `mcp_list` tool so ChatGPT can explicitly ask the gateway for current capabilities.
- Let the userscript build a live MCP catalog prompt from `/tools` and expose insert/copy affordances in the panel.

## Stage 3: Composer DOM Repair

Status: completed

- Prefer the visible `#prompt-textarea` / contenteditable composer over hidden fallback textareas.
- Keep clipboard fallback for true insert failures.
- Wait for the current ChatGPT send button state to appear after insertion before declaring auto-send failure.

## Stage 4: Verification And Close-Out

Status: completed

- Run `pnpm --filter @cwmb/protocol build`.
- Run `pnpm --filter @cwmb/gateway lint`.
- Run `pnpm --filter @cwmb/gateway test`.
- Run `pnpm --filter @cwmb/gateway build`.
- Run `pnpm --filter @cwmb/userscript lint`.
- Run `pnpm --filter @cwmb/userscript test`.
- Run `pnpm --filter @cwmb/userscript build`.
- Run `pnpm -r lint`.
- Run `pnpm -r test`.
- Run `pnpm -r build`.

## Risks

- The largest remaining risk is still real-page DOM drift: the new composer path now prefers visible contenteditable nodes and `#composer-submit-button`, but ChatGPT can change those selectors again.
- Tool discovery now depends on `/tools` being available and current; if gateway capability refresh fails, the catalog prompt can become stale.
- Trusted local mode intentionally removes token friction, so the remaining safety boundary depends more heavily on localhost-only binding, origin checks, and conservative default tool scope.
