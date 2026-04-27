# ChatGPT Web Runtime Evidence

## 0. Document Status

- Status: draft v1
- Scope: the single repository source of truth for real-page ChatGPT Web runtime evidence that affects DOM selectors, request shapes, injection timing, rendered message extraction, and result delivery behavior

This file exists to stop DOM/request-shape facts from being scattered across task docs, architecture notes, ad hoc comments, or stale troubleshooting bullets.

## 1. Ownership Rule

If a fact is about real ChatGPT Web runtime behavior, it belongs here first.

That includes:

- request endpoints and request body shapes
- composer selectors and send-button facts
- assistant/user turn DOM structure
- rendered code-block extraction behavior
- placeholder / thinking-status node behavior
- refresh / startup / history-rescan observations
- visible fallback paths that depend on real page behavior

Other docs may summarize or depend on these facts, but they should point back here instead of carrying their own drifting copy.

The v0.9 code module that may materialize these verified facts is `apps/extension/src/chatgpt-adapter/`. Keep the raw evidence here and the curated runtime constants/helpers there.

Implementation rule:

- raw page observations stay in this document
- curated selectors, placeholder rules, turn-id extraction, and other reusable ChatGPT-page helpers belong in `apps/extension/src/chatgpt-adapter/`
- consumer modules may read or compat-re-export those helpers, but they should not become parallel owners of the same page facts

## 2. What Does Not Belong Here

Do not use this file for:

- target-state architecture ownership
- policy vocabulary
- gateway-only behavior
- temporary task plans
- reference-project analysis

Those belong in:

- `docs/architecture/*`
- `docs/protocols/*`
- `docs/operations/{gateway,security,tool-policy}.md`
- `SPEC.md` / `IMPLEMENTATION_PLAN.md` / `TASK_STATUS.md`
- `docs/reference-*.md`

## 3. Evidence Record Format

Each evidence update should capture enough detail that a later Codex run can reason from the same page truth without re-reading scattered notes.

Record at least:

1. date collected
2. collection method
3. page state
4. observation
5. impact on current runtime or migration work
6. affected code/docs surfaces

Recommended shape:

```markdown
## Evidence: <short name>

- Date: 2026-04-27
- Method: real signed-in page / HAR / DOM snapshot / manual repro
- Page state: new chat / existing thread / refresh / streaming / post-result
- Observation:
  - ...
- Impact:
  - ...
- Affected surfaces:
  - ...
```

## 4. Collection Rules

Before changing ChatGPT Web DOM-sensitive behavior, collect or refresh evidence here if the change depends on:

- selectors
- request-hook matching
- request payload shape
- rendered-message parsing
- startup/history rescan behavior
- result insertion or send-button readiness

Minimum collection standard:

- one success-path observation
- one failure-path or drift-path observation when available
- the relevant page state called out explicitly

If the evidence is stale, partial, or missing, do not silently upgrade an assumption into repo truth.

## 5. Current Status

There is not yet a fully populated unified evidence pack here.

Current repo truth already says:

- real-page behavior matters more than prompt-only confidence
- the proven userscript runtime baseline exists and must be preserved or explicitly migrated
- the seeded v0.9 page-facts code owner currently covers selectors, conversation endpoints, turn-container fallbacks, send-button recognition, and ignorable status-text patterns

But the underlying DOM/request-shape observations still need to be centralized here before any DOM-heavy slice should expand.

## 6. How Other Docs Should Use This File

- `AGENTS.md` should point here for durable execution rules about ChatGPT Web DOM/request-shape evidence.
- `SPEC.md` and `IMPLEMENTATION_PLAN.md` should gate DOM-heavy slices on evidence collection or refresh.
- `TASK_STATUS.md` should record whether the evidence pack is sufficient for the active slice, not duplicate the raw findings.
- `docs/operations/troubleshooting.md` should send DOM/request-shape diagnosis here as the detailed evidence source.
- `apps/extension/src/chatgpt-adapter/` may turn verified evidence into canonical v0.9 runtime constants/helpers, but it must not become a second evidence log.

## 7. Related Documents

- [../prd.md](../prd.md)
- [../prd_vnext.md](../prd_vnext.md)
- [../v0.9-entrypoint.md](../v0.9-entrypoint.md)
- [troubleshooting.md](./troubleshooting.md)
- [../architecture/extension-runtime.md](../architecture/extension-runtime.md)

## Evidence: assistant turn source may need outer turn normalization

- Date: 2026-04-27
- Method: manual repro on a real signed-in page, plus local runtime/test analysis
- Page state:
  - existing thread
  - assistant reply containing natural-language text before and after a fenced `mcp` block
  - startup/history rescan also exercised on refresh
- Observation:
  - Manual repro showed that startup/history rescan correctly restored only the latest open assistant MCP turn after refresh.
  - The same manual repro window still allowed a prose-wrapped `mcp` turn to execute even after local parser rules were tightened to block prose before the first fenced `mcp` block.
  - Local code analysis plus targeted regression tests indicate the likely runtime cause: the assistant-message selector path can land on an inner assistant-tagged node whose visible text is only the code block, while the full outer assistant turn still contains the surrounding prose.
- Impact:
  - DOM-sensitive turn scanning should normalize assistant candidates back to the outer `[data-turn="assistant"]` container when present before running turn analysis.
  - Invalid-turn enforcement can otherwise diverge between local parser tests and live-page behavior because the parser sees only the code block text instead of the full assistant reply.
- Affected surfaces:
  - `apps/extension/src/chatgpt-adapter/chatgpt-runtime-facts.ts`
  - `apps/userscript/src/dom.ts`
  - `apps/userscript/src/dom.test.ts`
  - `apps/extension/src/turn-runtime/mcp-turn-analysis.ts`

## Evidence: rendered assistant text can stay prose-wrapped long after streaming completes

- Date: 2026-04-27
- Method: manual repro on a real signed-in page, console DOM trace, and opt-in userscript runtime diagnostics
- Page state:
  - existing thread
  - assistant reply streamed as natural-language sentence, then rendered `mcp` code block, then trailing natural-language completion text
  - auto execute enabled
- Observation:
  - Real-page console traces showed the latest assistant turn stabilizing as one `SECTION[data-turn="assistant"]` whose visible text remained `prefix prose + rendered mcp block + suffix prose` for more than 9 seconds after the block finished rendering.
  - The same run did not only expose a timing race: the mixed reply remained present well beyond any short stabilization window.
  - Opt-in runtime diagnostics confirmed that `scanLatestAssistantTurnSource()` read the full visible assistant text from that outer `SECTION`, but `analyzeMcpTurn()` still classified the mixed rendered reply as `valid` and let it enter `pending`.
  - This means rendered-turn invalidation cannot rely only on DOM code-block candidate extraction. The visible assistant text itself is a required parsing input for rendered `mcp` blocks, because DOM candidates may differ in formatting from the outer visible text while the live invalid-turn contract still depends on the visible reply content.
- Impact:
  - Turn-runtime parsing should treat visible rendered `mcp` text as a first-class source before falling back to DOM code-block candidates.
  - Adding only a short post-stream stability delay would not fix this failure mode, because the invalid mixed reply remains stable long after streaming has ended.
- Affected surfaces:
  - `apps/extension/src/turn-runtime/mcp-turn-analysis.ts`
  - `apps/userscript/src/parser.test.ts`
  - `apps/userscript/src/chatgpt-mcp-bridge.user.ts`

## Evidence: undelivered composer state survives refresh, and `composer-submit-button` can still be a stop button

- Date: 2026-04-27
- Method: manual repro on a real signed-in page with result-delivery validation
- Page state:
  - existing thread
  - single-result delivery with `Send=off`, followed by refresh on the same thread
  - assistant reply still streaming or stalled, with ChatGPT showing `#composer-submit-button[data-testid="stop-button"]`
- Observation:
  - When a bridge result was inserted into the ChatGPT composer but not sent, refreshing the same thread preserved that composer text.
  - Without an explicit undelivered-result restore path, startup/history rescan could treat the same assistant `mcp` turn as open again and re-execute it, causing duplicate insertion attempts against the already preserved composer text.
  - During streaming or a stalled tail, ChatGPT reused `#composer-submit-button` for a stop action with `data-testid="stop-button"` and an `aria-label` equivalent to `停止流式传输`, so button id alone was not enough to prove that the composer was ready to send.
- Impact:
  - Result-delivery recovery must persist enough undelivered state to survive refresh on the same conversation and suppress re-execution of the already handled `mcp` turn when the preserved composer still matches the pending bridge result.
  - Send-button detection must explicitly reject stop-streaming variants and wait for a real send affordance instead of treating every `#composer-submit-button` as ready.
- Affected surfaces:
  - `apps/extension/src/chatgpt-adapter/chatgpt-runtime-facts.ts`
  - `apps/userscript/src/inserter.ts`
  - `apps/userscript/src/state.ts`
  - `apps/userscript/src/chatgpt-mcp-bridge.user.ts`
