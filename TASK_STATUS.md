# Task Status

## Current Truth

- `docs/prd.md` 已经切到新的 v0.1 真相：ChatGPT Web only、trusted local mode 默认开启、`mcp_list` 进入默认工具面、三个自动化开关彼此独立且默认全开。
- The repository now appears code-complete for the documented v0.1 browser-to-gateway flow.
- Gateway tool descriptors now include example arguments, and a new low-risk `mcp_list` tool can return the current gateway catalog to ChatGPT itself.
- The userscript now builds a live MCP catalog prompt from `/tools` and injects it into outgoing ChatGPT conversation requests, so tool discovery no longer depends on visibly seeding the composer first.
- The userscript panel still exposes catalog copy/insert actions, but they are now fallback diagnostics instead of the primary capability-discovery path.
- The userscript now consumes gateway automation flags, auto-executes enabled tools, auto-inserts results, and auto-sends them by default while still gating execution on live `/tools` capabilities.
- Gateway now defaults to trusted local mode, so localhost `userscript -> gateway` calls no longer require a pairing token unless the user explicitly turns token auth back on.
- README and PRD now align on request-layer catalog injection as the default path, formalize the current `tool_result_batch` shape, and spell out threat-model / error-path acceptance examples more explicitly.
- In trusted local mode, the panel now reports `Token: off (trusted local mode)` and hides the token setup button instead of prompting for a pairing token that the default flow no longer needs.
- Updating the token or Gateway base URL in the panel now re-syncs gateway health and `/tools` capabilities immediately, so executable actions do not stay hidden until the next poll.
- The userscript now parses rendered ChatGPT code blocks from the real DOM instead of relying only on fenced markdown text, so automatic execution can start from actual ChatGPT replies where triple backticks are no longer visible.
- The rendered-code parser now tolerates ChatGPT code blocks whose visible text includes the `mcp` label or extra wrapper text before the JSON body, reducing regressions where a visible `mcp` block stayed undetected.
- The userscript now scans the current page once at startup, so an MCP block that is already rendered before the observer attaches still becomes runnable without waiting for a later DOM mutation.
- Single-tool deduplication is now scoped to the current assistant message identity instead of only the raw JSON body, so the same MCP request can appear again in a new conversation without being suppressed as already executed.
- Result insertion now prefers the visible `#prompt-textarea` / contenteditable composer over hidden fallback textareas and waits briefly for the real send button state before declaring auto-send failure.
- The userscript now installs its request hook at `document-start`, then delays UI/DOM observers until `DOMContentLoaded`, so the first ChatGPT message request can still be patched without breaking panel startup.
- The userscript now bootstraps the request-hook prompt from the last successful `/tools` snapshot before `DOMContentLoaded`, then warms it from a fresh gateway call in parallel so new-chat first turns do not depend solely on the current page's async panel sync.
- The injected tool-catalog prompt now explicitly tells ChatGPT to prefer Local MCP Bridge tools for `workspaceRoot` file tasks over unrelated built-in connectors such as GitHub or Gmail, and to report specific disabled bridge tools instead of claiming local tools are unavailable.
- Gateway startup now auto-creates `config.json` and backfills `workspaceRoot` from the current startup directory when the config is missing or incomplete.
- The userscript panel is now a collapsible inspector-style surface with runtime badges, expandable batch/result payloads, and an in-panel activity log stream.
- The panel activity log now records request-hook diagnostics for real ChatGPT conversation requests: injected, prompt-not-ready race, or matched-but-unpatched body.
- The userscript panel is now draggable and remembers its last user-placed position instead of staying fixed in one corner.
- The collapsed userscript panel now exposes the key immediate actions (`Run` / `Run all`, `Ignore`, `Retry batch`, `Insert result`) so pending tool handling no longer requires reopening the full inspector first.
- `Auto execute`, `Auto insert`, and `Auto send` now behave as real userscript-local overrides instead of passive status display.
- A userscript-local `Continue on error` toggle now defaults to off; when enabled, a batch keeps executing later tools after one tool call fails.
- Structured failure results now follow the same insert/send automation path as successful tool results.
- `search_files` now preserves its case-insensitive path-substring semantics while using `rg` for candidate prefilter when available and falling back to the Node walker if `rg` is missing or fails.
- `read_file` now blocks only high-confidence secret material and otherwise returns redacted content for lower-confidence assignment-style patterns such as `token = ...` or `api_key = ...`, avoiding full-file rejection during code review.
- `grep_files` now follows the same two-tier sensitive-content policy as `read_file`: high-confidence secrets block the response, while lower-confidence assignment-style patterns are redacted inline.
- `grep_files` now uses an explicit search contract: default `mode=literal` with either `query` or `patterns[]`, optional `mode=regex`, file-scope `match=all` for literal multi-pattern searches, and `engine` / `interpretedAs` metadata so zero-match results stay explainable.
- `grep_files` literal mode now uses `rg` only as a candidate-file prefilter when available; Node still owns final line matching, context assembly, secret handling, and truncation so `rg` availability cannot silently change the result contract.
- The injected userscript tool-catalog prompt now teaches the `grep_files` split explicitly: use `query` for one literal term, `patterns[]` for multiple literal terms, and `mode: "regex"` only when regex semantics are intentional.
- Single-tool failures now clear the pending item after result generation, preventing later gateway refreshes from re-running the same failed call implicitly.
- `mcp_list` now returns the full live gateway catalog including `mcp_list` itself, so its totals align with `/tools` and the injected MCP prompt.
- Gateway `/health` now exposes `maxToolRounds`, and the userscript now enforces that automatic tool-round guard per detected user request while leaving manual `Run` / `Run All` available.
- The gateway now ships an optional high-risk `write_file` tool behind `allowWrite=true`; it remains disabled by default and stays outside the automatic execution path even when enabled.
- Userscript automatic execution is now limited to enabled low-risk tools that do not require confirmation, so high-risk manual tools no longer ride the auto-run path by accident.
- Repository-level `lint`, `test`, and `build` entrypoints now pass across the workspace.

## Latest Verified Evidence

- `pnpm --filter @cwmb/protocol test` succeeded with 1 passing file and 3 passing tests.
- `pnpm --filter @cwmb/gateway lint` succeeded.
- `pnpm --filter @cwmb/gateway test` succeeded with 6 passing files and 13 passing tests.
- `pnpm --filter @cwmb/gateway build` succeeded.
- `pnpm --filter @cwmb/protocol build` succeeded.
- `pnpm --filter @cwmb/userscript lint` succeeded.
- `pnpm --filter @cwmb/userscript test` succeeded with 6 passing files and 19 passing tests.
- `pnpm --filter @cwmb/userscript build` succeeded.
- `pnpm --filter @cwmb/userscript lint` succeeded again after the inspector-panel and batch-control updates.
- `pnpm --filter @cwmb/userscript test` succeeded again with 7 passing files and 28 passing tests after the batch continue-on-error coverage was added.
- `pnpm --filter @cwmb/userscript build` succeeded again after the panel rewrite.
- `pnpm --filter @cwmb/gateway test` succeeded again with 7 passing files and 14 passing tests after adding `mcp_list` self-catalog and `/health` coverage.
- `pnpm --filter @cwmb/userscript test` succeeded again with 8 passing files and 31 passing tests after adding `maxToolRounds` round-guard coverage.
- `pnpm --filter @cwmb/gateway test` now succeeds with 8 passing files and 21 passing tests, including `write_file` coverage plus `search_files` coverage for `rg` success, `rg` failure fallback, and result alignment with the Node walker.
- `pnpm --filter @cwmb/shared test` now covers the split between blocking secrets and redaction-only assignment patterns.
- `pnpm --filter @cwmb/gateway test` now succeeds with 9 passing files and 23 passing tests, including `read_file` coverage for redacted placeholder assignments versus blocked high-confidence secrets.
- `pnpm --filter @cwmb/gateway test` now also covers `grep_files` with the same split: placeholder assignments are redacted in results, while high-confidence secrets raise `SENSITIVE_CONTENT_BLOCKED`.
- `pnpm --filter @cwmb/gateway lint` succeeded again after the `grep_files` contract change to `query` / `patterns[]` / `regex`.
- `pnpm --filter @cwmb/gateway test` now succeeds with 9 passing files and 27 passing tests, including `grep_files` schema validation, literal multi-pattern `match=all`, explicit regex mode, and the fixed `rg` candidate-file path handling.
- `pnpm --filter @cwmb/userscript test` now succeeds with 8 passing files and 32 passing tests after syncing MCP examples from `grep_files.pattern` to `grep_files.query`.
- `pnpm --filter @cwmb/userscript test` succeeded again after adding the prompt-level `grep_files` usage guidance.
- `pnpm --filter @cwmb/userscript build` succeeded again after the catalog prompt update.
- `pnpm --filter @cwmb/userscript test` now covers manual-only gating for high-risk or confirmation-required tools.
- `pnpm --filter @cwmb/protocol build` succeeded again before the latest userscript verification pass.
- `pnpm --filter @cwmb/userscript lint` succeeded again after adding stored catalog bootstrap support for first-turn request injection.
- `pnpm --filter @cwmb/userscript test` now succeeds with 9 passing files and 35 passing tests, including stored tool-catalog bootstrap coverage.
- `pnpm --filter @cwmb/userscript build` succeeded again after the startup bootstrap change.
- `pnpm --filter @cwmb/userscript test` now also covers the stronger catalog prompt wording for native-connector override guidance.
- `pnpm -r lint` succeeded.
- `pnpm -r test` succeeded across protocol, shared, gateway, and userscript.
- `pnpm -r build` succeeded across protocol, shared, gateway, and userscript.

## Stop Line

- The main remaining work is live manual validation against real ChatGPT Web traffic after the request-layer prompt injection switch.
- The main remaining work is live manual validation against real ChatGPT Web traffic for the startup race boundary: cached-catalog bootstrap is now covered by unit tests, but a truly first-ever session without cache still needs manual confirmation.
- The other remaining acceptance item is real-page confirmation that the stronger prompt wording is enough to stop ChatGPT from falling back to unrelated native connectors when local bridge tools are available.
- The next acceptance step is a browser session that confirms three things together: hidden tool-hint injection, actual MCP block emission by ChatGPT, and end-to-end execute/insert/send behavior on the real page.

## Caveats

- This repo still lacks browser-driven end-to-end automation, so the final v0.1 claim depends on manual live acceptance rather than only unit and build checks.
- Because ChatGPT Web can change its request payload shape, the new invisible injection path is best-effort and should degrade to the panel's manual catalog actions when the outgoing JSON shape drifts.
- The new automation controls are userscript-local overrides today; there is still no gateway `/settings` API for persisting them centrally.
- Optional or later-scope PRD items remain intentionally out of scope: dynamic `/settings`, `/logs` endpoint work, `write_file_proposal`, `run_pwsh`, `apply_proposal`, and Chrome extension migration; `write_file` exists only as a gated local self-hosting escape hatch, not as a default v0.1 workflow.
