# Current Scope Spec

Current boundary: as of April 27, 2026, the v0.1 real-page stop line is closed. This file now tracks the active v0.9 mainline scope. `docs/prd.md` remains the closed v0.1 reference baseline; [docs/v0.9-entrypoint.md](docs/v0.9-entrypoint.md) and [docs/prd_vnext.md](docs/prd_vnext.md) are the active target-state entry docs.

## Goal

Turn the proven v0.1 userscript + gateway baseline into the real v0.9 product target, ChatGPT Web Local Agent Bridge, while keeping the current live runtime contracts explicit until each one is intentionally migrated or replaced.

## Current Slice

Phase 1 shared-contract freeze is complete. Stages 7—21 are complete. Stage 21 `remove-compat-layers` formally closed on April 28, 2026 after real ChatGPT Web extension-only validation in a real browser.

Phase 2 is complete. The most recently closed follow-on slice is Phase 2.5 extension convergence: one coordinated extension-side phase that lands `WXT`, popup/options, `React` + `Tailwind CSS` operator-facing UI, and capability-domain owner refactoring together while preserving the live browser-to-gateway floor.

On April 29, 2026, the user confirmed the full real ChatGPT Web validation pass for that Phase 2.5 convergence pack, so there is currently no active follow-on slice.

Phase 2.5 stack baseline:

- keep the repo on one declared stack: `pnpm` workspace plus `TypeScript` across the whole project
- converge the extension shell on `WXT` + Chrome Extension `MV3`
- converge operator-facing extension UI on `React` + `Tailwind CSS`
- keep the gateway on `Fastify` + `TypeScript`
- keep shared contracts and models on focused `TypeScript` packages with `Zod` runtime schemas
- keep `Vitest` as the default unit and module test runner

Primary battleground:

- Extension Ring, with explicitly allowed supporting Final Core owner realignment on the extension side

Primary axis:

- `WXT` shell convergence, multi-surface operator UI, and extension capability-domain owner refactoring under one explicit design

Historical Phase 2 module order:

1. `turn-runtime`
2. `result-delivery`
3. `injection-runtime`
4. `operator-panel`
5. `execution-kernel`
6. `tool-registry`
7. `tool-policy`
8. `builtin-tools`
9. `shell-runtime`
10. `audit-log`
11. `diagnostics`
12. `package-domain-extraction`
13. `extension-structure`
14. `gateway-structure`
15. `remove-compat-layers`

## Phase 2 Program Contract

Every Phase 2 stage must obey all of the following rules:

1. Exactly one primary module stage is active at a time.
2. The active stage owns one long-term target module plus only the narrow compat seams, shared contracts, and docs required to complete that module safely.
3. Supporting edits outside the active module are allowed only when they directly improve the active module's ownership boundary, runtime timing, failure isolation, or verification path.
4. A stage may optimize logic, timing, and stability aggressively inside its declared boundary, but it may not use that freedom to open a neighboring module, capability family, or product-scope debate.
5. The current live runtime floor remains authoritative until a replacement path is explicitly documented and re-verified:
   - `/health`
   - `/tools`
   - `/call-tool`
   - hidden request-layer injection
   - invalid-turn enforcement
   - startup/history rescan
   - execute / insert / send runtime semantics
6. Userscript files are behavior evidence and temporary compat surfaces only. They are not a target architecture obligation.
7. Phase 2 optimization is not only structural. Each stage must make the active module more testable and easier to validate than before, even when the functional behavior is preserved.

## Per-Stage Optimization Dimensions

Each module stage should be planned and judged against the same five dimensions:

- Ownership clarity: one obvious long-term owner for the module's runtime truth, with compat layers reduced to translation only.
- Timing clarity: fewer ambiguous sequencing paths, race windows, or hidden ordering dependencies in the active module.
- Logic clarity: less duplicated branching, fewer mixed responsibilities, and cleaner dependency direction.
- Stability: narrower failure surfaces, better invalid-state handling, and less accidental regression risk for adjacent modules.
- Validation coverage: more direct tests for the extracted owner plus explicit adjacent regression checks for the still-live baseline.

## Stage Entry And Exit Rules

Entry gate for any Phase 2 stage:

- `TASK_STATUS.md` declares the active module stage explicitly.
- `IMPLEMENTATION_PLAN.md` lists the stage's owner surfaces, supporting surfaces, constraints, validation, and definition of done.
- Any DOM/request-shape assumption needed by the stage is already recorded in `docs/operations/chatgpt-web-runtime-evidence.md`.

Exit gate for any Phase 2 stage:

- The long-term owner for the stage is explicit in docs and code boundaries.
- The active module's primary logic no longer depends on a compat file as its hidden source of truth.
- Stage-local tests cover the owner semantics directly.
- Adjacent compat-path regressions are checked where the still-live runtime depends on them.
- Root `pnpm lint`, `pnpm test`, and `pnpm build` pass after the slice.
- Real ChatGPT Web validation is run before claiming completion for any stage that changes browser runtime timing, DOM interaction, injection, turn detection, insertion, or operator-visible recovery behavior.

## Current Stage State

Active module stage: none. The most recently fully closed Phase 2 stage is `remove-compat-layers` (Stage 21).

Phase 2.5 is now closed, and its design truth remains in [docs/architecture/phase2.5-extension-convergence.md](docs/architecture/phase2.5-extension-convergence.md) as the acceptance-backed record for that convergence pack.

Stages 20-21 remain defined in `IMPLEMENTATION_PLAN.md` for auditability. Do not infer any follow-on slice beyond the closed Phase 2.5 pack until the root task-control docs explicitly activate one.

Follow-on stack guard:

- do not open a new slice that introduces a second extension scaffold beside `WXT`
- do not open a second operator-facing UI framework beside `React` + `Tailwind CSS`
- do not treat stack standardization as permission to rewrite gateway owners away from `Fastify` + `TypeScript`
- keep the in-page panel as the primary operator surface even after popup/options land
- keep background-owned configuration truth separate from page-owned conversation runtime truth

Most recently completed module-stage file surfaces:

- `packages/shared-utils/*`
- `packages/turn-model/*`
- `packages/policy-model/*`
- `packages/result-model/*`
- `packages/tool-contracts/*`
- `packages/test-fixtures/*`
- `apps/gateway/package.json`
- `apps/extension/src/main/*`
- `apps/gateway/src/main/*`
- `apps/userscript/README.md`
- the root task-control docs

Most recently completed stage intent:

- replace the catch-all protocol package with explicit domain package boundaries visible in workspace dependencies
- keep runtime behavior and contract shapes unchanged while rewiring imports, schemas, compat helpers, and constants into their focused owner packages
- leave no active module stage after the package split completes; that gate is now closed because Stage 19 has been explicitly activated for extension-shell work

## In Scope

- Keep the current live runtime behavior documented in `docs/prd.md` as the migration floor rather than the active product target.
- Treat `apps/userscript` as a behavior reference baseline, not as a target v0.9 app layer that must survive as a formal compat shell.
- Preserve current live contracts during Phase 2 unless a migration path is explicitly documented:
  - `/health`
  - `/tools`
  - `/call-tool`
  - hidden request-layer injection
  - invalid-turn enforcement
  - startup/history rescan
  - execute / insert / send runtime semantics
- Run Phase 2 as the declared ordered module program across `apps/extension` first and `apps/gateway` second.
- For each stage, define:
  - long-term owner surfaces
  - narrow supporting or compat surfaces
  - timing and logic optimization targets
  - required regression coverage
  - explicit definition of done
- Land durable implementation in `apps/extension` and `apps/gateway` when that shortens the path or improves runtime boundaries instead of recreating the same logic under userscript-shaped layers.
- Keep userscript-side consumption on thin compatibility wiring only where the current live baseline still requires it during migration.
- Keep `docs/operations/chatgpt-web-runtime-evidence.md` as the only allowed repository source for ChatGPT Web DOM/request-shape/selectors evidence.
- Update root task-control docs whenever the active v0.9 slice, gate, validation rule, or sequencing truth changes.
- Standardize follow-on work on one project stack: `pnpm` workspace, repo-wide `TypeScript`, extension-shell target `WXT` + Chrome Extension `MV3`, operator-facing extension UI target `React` + `Tailwind CSS`, gateway `Fastify` + `TypeScript`, shared `Zod` schemas, and `Vitest` for unit/module tests.
- Use Phase 2.5 to converge extension runtime ownership onto capability domains that can serve in-page panel, popup, and options cleanly without creating a second execution architecture.
- Make background/service worker the owner for persisted extension configuration truth while keeping page runtime as the owner of conversation-scoped live runtime truth.
- **Stages 18—21 extend Phase 2 to complete the target structure:**
  - Split `packages/protocol/` into domain packages (`turn-model`, `tool-contracts`, `policy-model`, `result-model`), rename `shared/` to `shared-utils/`, create `test-fixtures/`, and delete `protocol/` (Stage 18).
  - Complete the Chrome Extension shell with manifest v3, background service worker, content script, and `main/` composition root, making `apps/extension/` the primary browser runtime (Stage 19).
  - Complete the gateway module layout: `api/` (replacing `routes/`), `proposal-engine/` (typed interface + stub), `external-mcp/` (typed interface + stub), `result-cache/` (typed interface + in-memory impl), and `main/` composition root (Stage 20).
  - Delete all compat re-exports (`routes/`, `tools/`, `security/`, `shell/`, `utils/`) and archive `apps/userscript/` as a legacy reference, leaving the target structure as the only structure (Stage 21, complete).

## Out Of Scope

- Reopening v0.1 as the active product target.
- Pretending v0.9 is already shipped because the target docs are mature.
- Breaking the current userscript + gateway baseline without an explicit migration and re-verification plan.
- Opening more than one primary module stage in the same round.
- Broad capability rollout such as:
  - full proposal workflow (structural `proposal-engine/` stub with typed interfaces is in scope via Stage 20; full workflow implementation with reviewed/yolo/mode-aware lifecycle is not)
  - `reviewed` / `yolo` execution rollout
  - `run_pwsh` shipping as general product scope
  - external/custom MCP rollout (structural `external-mcp/` stub with typed interfaces is in scope via Stage 20; full MCP connection lifecycle and proxying is not)
- DOM-heavy runtime rewrites based on unrecorded or scattered page observations.
- Multi-platform browser AI support.
- Session management as a primary product line.
- Store, analytics, remote config, or marketplace work as the mainline.

## Constraints

- On April 27, 2026, the user confirmed live signed-in ChatGPT Web acceptance and formally closed the v0.1 stop line.
- `docs/prd.md` is now a closed reference baseline: useful for current runtime truth, but no longer the active product target.
- Root `SPEC.md`, `IMPLEMENTATION_PLAN.md`, and `TASK_STATUS.md` now track the active v0.9 program, not the old v0.1 close-out loop.
- Draft-marked v0.9 docs remain editable target-state references. They do not create extra compatibility obligations unless the current live runtime or task-control docs explicitly adopt the relevant field, path, or behavior as part of the active floor.
- No Phase 2 slice may silently invalidate a current live contract or runtime guarantee without:
  - updated product and migration docs
  - a replacement path
  - re-verification on the real ChatGPT page when browser runtime behavior is affected
- The current compatibility floor must remain stable during Phase 2:
  - `/health`
  - `/tools`
  - `/call-tool`
  - hidden request-layer injection
  - invalid-turn enforcement
  - startup/history rescan
  - execute / insert / send runtime semantics
- Phase 2 must keep converging runtime ownership into `apps/extension` and `apps/gateway`; it must not reframe `apps/userscript` as the intended final shell, product surface, or default landing zone for new long-term behavior.
- Stage 19 must produce a real, installable Chrome Extension (manifest v3, service worker, content script) that fully owns the browser runtime; Stage 21 must archive `apps/userscript/` as a legacy reference, removed from the workspace.
- Stage 18 must delete `packages/protocol/` and rename `packages/shared/` to `packages/shared-utils/` — no facade re-exports, no transitional package aliases.
- Stage 20 must deliver `proposal-engine/` and `external-mcp/` as typed interfaces plus stubs only — capability rollout remains deferred to later phases.
- Stage 21 must not delete any file that still owns unique runtime behavior — if a compat file contains logic not yet migrated, stop and complete the migration first.
- ChatGPT Web DOM/request-shape facts must be recorded in `docs/operations/chatgpt-web-runtime-evidence.md` rather than duplicated across multiple docs.
- If the active stage needs new page facts, the curated owner remains `apps/extension/src/chatgpt-adapter/*`; the stage must not mint a second page-facts source of truth.
- Parser-level turn normalization must converge into `apps/extension/src/turn-runtime/*` rather than remaining a long-term truth source inside `apps/userscript/src/parser.ts`.
- Verification must remain reproducible from the repo root whenever code changes are made.
- Phase 2.5 may reorganize extension-side owner names and boundaries, but it must preserve the live compatibility floor until the replacement path is re-verified on the real ChatGPT page.
- Phase 2.5 must not let popup or options become alternate execution architectures; they are supporting surfaces around the primary in-page panel path.

## Acceptance Criteria

- Root task-control docs consistently state that v0.1 closed on April 27, 2026 and now serves as a reference baseline only.
- `docs/v0.9-entrypoint.md`, `docs/prd_vnext.md`, and the root task docs all agree that v0.9 is the active mainline.
- The full Phase 2 module order is explicit enough that execution can continue without reopening the overall sequencing question.
- The current active or most recently closed module-stage state is explicit enough that implementation can proceed without reopening which extraction boundary is in play.
- `IMPLEMENTATION_PLAN.md` contains, for every Phase 2 stage:
  - owner surfaces
  - allowed supporting surfaces
  - timing, logic, and stability objectives
  - required validation coverage
  - explicit definition of done
- The current runtime contracts that must survive early migration work are clearly enumerated in repo docs.
- No active task-control or v0.9 entry doc still says that v0.1 close-out is blocking v0.9 by default.
- Phase 2 clearly limits itself to one active module stage at a time instead of broad new capabilities or parallel extraction axes.
- The repo has one explicit source of truth for ChatGPT Web DOM/request-shape evidence, and the task docs point to it instead of duplicating its content.
- The `operator-panel` stage has one explicit v0.9 owner target for runtime snapshot display, operator intents, and diagnostics entrypoints, and current userscript panel modules are treated as compat consumers rather than the long-term source of truth.
- Every Phase 2 stage requires root verification, and browser-runtime stages additionally require real ChatGPT Web validation before being called complete.
- Phase 2.5 is explicit enough that implementation can proceed without reopening whether `WXT`, popup/options, `React` + `Tailwind CSS`, and extension owner refactoring belong in one coordinated slice.
