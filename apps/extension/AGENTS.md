# Extension Agent Notes

## Scope

- This file applies to `apps/extension`.

## Ownership

- `apps/extension/src/chatgpt-adapter/` is the canonical v0.9 code owner for ChatGPT Web page facts such as selectors, known conversation endpoints, turn-container fallbacks, send-button recognition, and ignorable status-text patterns.
- `apps/extension/src/injection-runtime/`, `operator-panel/`, `result-delivery/`, `turn-runtime/`, `settings/`, `ui-surfaces/`, `operator-workflows/`, and `main/` are the current live extension owners. Phase 2.5 is explicitly allowed to keep converging the legacy runtime names toward target capability domains such as `request-injection` and `turn-detection`, but do not recreate parallel truth in archived legacy code.

## Working Rule

- Stage 21 removed the userscript runtime path from the active workspace. `apps/extension` now owns the only supported browser shell: `wxt.config.ts`, `entrypoints/*`, background service worker, content-script entrypoints, main-world request hook, and `src/main/*` composition root.
- For active Phase 2.5 stack work, the extension target is `WXT` + Chrome Extension `MV3`, with `React` + `Tailwind CSS` reserved for operator-facing extension UI surfaces such as the in-page panel, popup, and options.
- Keep `src/extension-shell/*` focused on Chrome-extension host concerns such as lifecycle, messaging, page-world bridging, settings relay, and mount boundaries. Do not move page facts, turn parsing, result semantics, or operator-panel view-state truth out of their existing owner modules just because the shell is now real.
- Keep `src/settings/*` as the owner for background-owned persisted configuration truth and cross-surface settings contracts. Do not move extension-global settings persistence back into page-local `GM_*` helpers.
- Keep `src/operator-workflows/*` focused on shared work-surface contracts, serializable action/snapshot envelopes, and workflow-first owner logic that both floating panel and side panel can consume. Do not let side-panel-only orchestration or React-local component state become a second source of workflow truth.
- Keep capability-domain owner logic in plain TypeScript modules even while Phase 2.5 renames or splits the current owners. Do not wrap page facts, turn classification, request injection, result delivery, operator workflow logic, or bridge-facing orchestration inside React components, hooks, or Tailwind-driven view abstractions.
- Before promoting a new selector, request-shape assumption, prompt-contract text dependency, or DOM timing fact here, record or refresh the matching evidence in `docs/operations/chatgpt-web-runtime-evidence.md` first.

## Validation

- Validate extension work with `pnpm --filter @cwmb/extension lint`, `test`, and `build`, then run root `pnpm lint`, `pnpm test`, and `pnpm build`.
- If browser runtime timing, DOM interaction, injection, insertion, send behavior, or operator-visible recovery changes, real ChatGPT Web validation is still required before calling the slice complete.
