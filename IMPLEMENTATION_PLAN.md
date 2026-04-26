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

## Stage 4: Inspector Panel And Failure Controls

Status: completed

- Redesign the userscript panel into a collapsible inspector surface with runtime badges, expandable payload details, and an activity log stream.
- Turn `Execute`, `Insert`, and `Send` into real local override toggles that affect later detections/results immediately.
- Add a local `Continue on error` toggle for batch execution, defaulting to fail-stop behavior.
- Keep structured failure results on the same insert/send delivery path as successful results.

## Stage 5: Verification And Close-Out

Status: completed

- Make `mcp_list` return the exact live catalog, including `mcp_list` itself, so totals stay aligned with `/tools` and the injected prompt.
- Expose `maxToolRounds` through `/health` and enforce it in the userscript's automatic execution loop without blocking manual continuation.
- Add a gated high-risk `write_file` tool for local self-hosting, and tighten userscript auto-execution so only low-risk non-confirmation tools can run automatically.
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
- First-turn injection now bootstraps from the last successful catalog snapshot, but a truly first-ever session with no cache still depends on the initial `/tools` refresh winning the race.
- Even with bootstrap in place, ChatGPT may still ignore or override prompt hints; request-hook diagnostics and stronger prompt wording reduce ambiguity, but real-page behavior remains the final authority.
- Synthetic `system` message injection is still experimental: ChatGPT may accept it, ignore it, or later surface it differently than prepend-user injection, so HAR and share-page validation remain necessary.
- Once synthetic `system` injection is validated on real ChatGPT traffic, prepend-user should be downgraded from an operator-facing control to a hidden compatibility fallback.
- Trusted local mode intentionally removes token friction, so the remaining safety boundary depends more heavily on localhost-only binding, origin checks, and conservative default tool scope.
