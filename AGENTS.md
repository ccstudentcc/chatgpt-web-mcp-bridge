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
- When working under `apps/extension`, `apps/gateway`, or `apps/userscript`, read the local `AGENTS.md` after this file and treat it as the subtree delta.

## Durable Workflow

- When a change modifies the proven runtime baseline or validation floor, update `docs/prd.md` and sync the task-control docs in the same pass.
- When a change modifies the active v0.9 product boundary, migration order, or target ownership, update the matching `docs/prd_vnext.md`, `docs/v0.9-entrypoint.md`, `docs/architecture/*`, `docs/protocols/*`, or `docs/operations/*` docs in the same pass, then sync the task-control docs.
- When Stage 18-21 work changes package names, app structure, or compat-layer ownership, update the affected local `AGENTS.md` files in the same pass so subtree rules keep matching the live workspace layout.
- After a Phase 2 stage closes, do not infer the next stage from the declared order alone. Treat `no active module stage` as a real stop state until `SPEC.md`, `IMPLEMENTATION_PLAN.md`, and `TASK_STATUS.md` explicitly activate the next stage.
- Treat draft v0.9 docs and draft contract shapes as reference truth for direction, not as compatibility targets by themselves. Preserve or migrate the current live runtime baseline; do not spend compatibility budget on draft wording or draft-only fields unless task-control docs explicitly promote them into the live floor.
- For any UI/UX design, redesign, visual polish, or operator-facing interface work, use the `ui-ux-pro-max` skill first. Start with its required `--design-system` workflow, and if the stack is not explicitly specified, default to the skill's `html-tailwind` guidance instead of improvising a design direction.
- When the user authorizes sustained v0.9 progress with automatic commits, work on the corresponding phase mainline branch by default, currently `agent/v0.9-phase2-mainline` for Phase 2. Do not create per-stage branches unless the user explicitly asks for one, keep each commit scoped to one phase-aligned slice, and sync `TASK_STATUS.md` before every commit or session handoff.
- For Phase 1 shared-contract freeze work, land shared `packages/protocol` contract surfaces first and keep same-pass app changes limited to narrow compatibility adapters; do not mix this slice with broader extension or gateway extraction.
- When a change modifies the gateway-to-userscript contract, such as `/health`, `/tools`, or `mcp_list` metadata, update the matching gateway/userscript tests in the same pass.
- When a change modifies MCP-turn formatting or invalid-turn behavior, keep the runtime classifier, the visible/manual prompt contract (`Insert MCP list` / `Copy MCP list`), the hidden injected prompt, and the repo docs aligned in the same pass. Do not let runtime enforcement become stricter or looser than the documented prompt contract.
- When changing visible/manual or hidden injected prompt text, keep shared tool-guidance text under one owner path, currently `apps/extension/src/injection-runtime/catalog.ts`, instead of maintaining separate copies.
- Any bridge prompt rewrite must go through the `llm-prompt-optimizer` skill before landing. Keep the meaning intact, prefer lossless compression, and update prompt regression tests in the same pass.
- Keep ChatGPT Web DOM/request-shape/selectors evidence in one place only: `docs/operations/chatgpt-web-runtime-evidence.md`. Do not scatter the same runtime facts across task docs or neighboring runbooks.
- Before changing ChatGPT Web DOM-sensitive behavior, collect or refresh the relevant real-page evidence in `docs/operations/chatgpt-web-runtime-evidence.md` first. If the evidence is missing, partial, or stale, do not promote the assumption into repo truth.
- The canonical v0.9 code owner for ChatGPT Web page facts is `apps/extension/src/chatgpt-adapter/`. Current `apps/userscript` code may only consume or compat-re-export those facts; do not create a second page-facts source of truth under the frozen v0.1 implementation tree.
- When a new helper, selector, placeholder rule, turn-id rule, or other ChatGPT-page fact is discovered, land it under `apps/extension/src/chatgpt-adapter/` first. Do not bury page facts inside `apps/userscript`, `turn-runtime`, or other consumers unless they are thin compat re-exports.
- The v0.9 end state is `apps/extension` plus `apps/gateway`, not a polished or durable `apps/userscript` shell. Treat current userscript code only as the live compatibility carrier or reference baseline while behavior is still being replaced and re-verified.
- Until an approved migration says otherwise, treat `/health`, `/tools`, `/call-tool`, hidden request-layer injection, invalid-turn enforcement, startup/history rescan, and execute/insert/send behavior as the active compatibility floor.
- Do not start broad v0.9 capability rollout by default. Start from the currently active slice in `SPEC.md` / `IMPLEMENTATION_PLAN.md` / `TASK_STATUS.md`.
- Keep repository execution rules in `AGENTS.md`; keep temporary scope, rollout status, and open questions in the task-control docs.

## Validation

- Use workspace scripts from the repo root: `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint`.
- When app-local work consumes new exports from workspace packages, rebuild those dependency packages first. Current enforced paths are `apps/userscript` -> `@cwmb/shared-utils`, `@cwmb/turn-model`, `@cwmb/result-model`, `@cwmb/tool-contracts`; and `apps/gateway` -> `@cwmb/shared-utils`, `@cwmb/turn-model`, `@cwmb/policy-model`, `@cwmb/result-model`, `@cwmb/tool-contracts`.
- For `apps/userscript` UI, DOM, or automation changes, run `pnpm --filter @cwmb/userscript lint`, `test`, and `build` before the wider root-level verification.
- Stage explicit file paths when committing from a dirty tree.
