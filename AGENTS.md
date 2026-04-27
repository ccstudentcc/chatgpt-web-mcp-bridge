# ChatGPT Web MCP Bridge Agent Notes

## Scope

- This file applies to the whole repository.
- Put execution rules here, not product or architecture truth.
- Keep the closed v0.1 runtime baseline in `docs/prd.md`.
- Keep the active v0.9 product target in `docs/prd_vnext.md` and the linked `docs/architecture/*`, `docs/protocols/*`, and `docs/operations/*` docs.

## Read Order

- For non-trivial v0.9 work, read in this order:
  1. `docs/prd.md` for the proven runtime baseline that must be preserved or explicitly migrated
  2. `docs/v0.9-entrypoint.md`
  3. `docs/prd_vnext.md`
  4. `SPEC.md`
  5. `IMPLEMENTATION_PLAN.md`
  6. `TASK_STATUS.md`

## Durable Workflow

- When a change modifies the proven runtime baseline or validation floor, update `docs/prd.md` and sync the task-control docs in the same pass.
- When a change modifies the active v0.9 product boundary, migration order, or target ownership, update the matching `docs/prd_vnext.md`, `docs/v0.9-entrypoint.md`, `docs/architecture/*`, `docs/protocols/*`, or `docs/operations/*` docs in the same pass, then sync the task-control docs.
- When the user authorizes sustained v0.9 progress with automatic commits, create a dedicated `agent/*` branch before the first code change, keep each commit scoped to one phase-aligned slice, and sync `TASK_STATUS.md` before every commit or session handoff.
- For Phase 1 shared-contract freeze work, land shared `packages/protocol` contract surfaces first and keep same-pass app changes limited to narrow compatibility adapters; do not mix this slice with broader extension or gateway extraction.
- When a change modifies the gateway-to-userscript contract, such as `/health`, `/tools`, or `mcp_list` metadata, update the matching gateway/userscript tests in the same pass.
- Keep ChatGPT Web DOM/request-shape/selectors evidence in one place only: `docs/operations/chatgpt-web-runtime-evidence.md`. Do not scatter the same runtime facts across task docs or neighboring runbooks.
- Before changing ChatGPT Web DOM-sensitive behavior, collect or refresh the relevant real-page evidence in `docs/operations/chatgpt-web-runtime-evidence.md` first. If the evidence is missing, partial, or stale, do not promote the assumption into repo truth.
- The canonical v0.9 code owner for ChatGPT Web page facts is `apps/extension/src/chatgpt-adapter/`. Current `apps/userscript` code may only consume or compat-re-export those facts; do not create a second page-facts source of truth under the frozen v0.1 implementation tree.
- Until an approved migration says otherwise, treat `/health`, `/tools`, `/call-tool`, hidden request-layer injection, invalid-turn enforcement, startup/history rescan, and execute/insert/send behavior as the active compatibility floor.
- Do not start broad v0.9 capability rollout by default. Start from the currently active slice in `SPEC.md` / `IMPLEMENTATION_PLAN.md` / `TASK_STATUS.md`.
- Keep repository execution rules in `AGENTS.md`; keep temporary scope, rollout status, and open questions in the task-control docs.

## Validation

- Use workspace scripts from the repo root: `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint`.
- For `apps/userscript` UI, DOM, or automation changes, run `pnpm --filter @cwmb/userscript lint`, `test`, and `build` before the wider root-level verification.
- Stage explicit file paths when committing from a dirty tree.
