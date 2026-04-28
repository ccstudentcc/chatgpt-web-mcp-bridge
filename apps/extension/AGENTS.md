# Extension Agent Notes

## Scope

- This file applies to `apps/extension`.

## Ownership

- `apps/extension/src/chatgpt-adapter/` is the canonical v0.9 code owner for ChatGPT Web page facts such as selectors, known conversation endpoints, turn-container fallbacks, send-button recognition, and ignorable status-text patterns.
- When current runtime code still needs those facts, adapt from this module outward; do not create a second source of truth under `apps/userscript`.
- `apps/extension/src/injection-runtime/`, `operator-panel/`, `result-delivery/`, and `turn-runtime/` are the current long-term owners for extracted browser-runtime logic. When userscript still consumes that behavior, import from these modules instead of rebuilding local copies.

## Working Rule

- `apps/extension` is not a standalone app package yet. Keep it focused on target ownership boundaries and reusable pure/runtime helpers; do not add a second browser bootstrap shell, manifest, or composition root before Stage 19 `extension-structure` is explicitly activated in the task-control docs.
- Before promoting a new selector, request-shape assumption, prompt-contract text dependency, or DOM timing fact here, record or refresh the matching evidence in `docs/operations/chatgpt-web-runtime-evidence.md` first.

## Validation

- `apps/extension` has no local `package.json`; until Stage 19 makes it a real package with its own scripts, validate changes through the current consumers.
- If a change is consumed by userscript, run `pnpm --filter @cwmb/userscript lint`, `test`, and `build`, then run root `pnpm lint`, `pnpm test`, and `pnpm build`.
- If browser runtime timing, DOM interaction, injection, insertion, send behavior, or operator-visible recovery changes, real ChatGPT Web validation is still required before calling the slice complete.
