# Extension Agent Notes

## Scope

- This file applies to `apps/extension`.

## Ownership

- `apps/extension/src/chatgpt-adapter/` is the canonical v0.9 code owner for ChatGPT Web page facts such as selectors, known conversation endpoints, turn-container fallbacks, send-button recognition, and ignorable status-text patterns.
- `apps/extension/src/injection-runtime/`, `operator-panel/`, `result-delivery/`, `turn-runtime/`, and `main/` are the current long-term browser-runtime owners. Do not recreate parallel truth in archived legacy code.

## Working Rule

- Stage 21 removed the userscript runtime path from the active workspace. `apps/extension` now owns the only supported browser shell: manifest v3, background service worker, content-script entrypoints, main-world request hook, and `src/main/*` composition root.
- Keep `src/extension-shell/*` focused on Chrome-extension host concerns such as lifecycle, messaging, page-world bridging, and mount boundaries. Do not move page facts, turn parsing, result semantics, or operator-panel view-state truth out of their existing owner modules just because the shell is now real.
- Before promoting a new selector, request-shape assumption, prompt-contract text dependency, or DOM timing fact here, record or refresh the matching evidence in `docs/operations/chatgpt-web-runtime-evidence.md` first.

## Validation

- Validate extension work with `pnpm --filter @cwmb/extension lint`, `test`, and `build`, then run root `pnpm lint`, `pnpm test`, and `pnpm build`.
- If browser runtime timing, DOM interaction, injection, insertion, send behavior, or operator-visible recovery changes, real ChatGPT Web validation is still required before calling the slice complete.
