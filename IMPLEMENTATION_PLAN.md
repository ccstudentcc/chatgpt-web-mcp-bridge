# Implementation Plan

Current boundary: as of April 27, 2026, v0.1 close-out is complete. This plan now tracks the active v0.9 mainline program.

## Stage 1: Close And Archive The v0.1 Baseline

Status: completed

- Record that the user completed real signed-in ChatGPT Web validation on April 27, 2026.
- Formally close the v0.1 stop line.
- Keep `docs/prd.md` as the closed reference baseline for the proven userscript + gateway behavior.

## Stage 2: Promote v0.9 Docs To Active Mainline Truth

Status: completed

- Make `docs/v0.9-entrypoint.md` the navigation home for the active target-state doc pack.
- Repoint root task-control docs away from v0.1 close-out and toward v0.9 mainline coordination.
- Align authority and read order across:
  - `docs/v0.9-entrypoint.md`
  - `docs/prd_vnext.md`
  - `docs/architecture/*`
  - `docs/protocols/*`
  - `docs/operations/*`

## Stage 3: Define The First Concrete v0.9 Delivery Slice

Status: completed

Active slice: Phase 1 shared-contract freeze.

Primary battleground:

- Final Core

Current goal:

- freeze one shared contract vocabulary before any broad extraction or capability rollout

Concrete work in this stage:

1. Define stable target shapes and ownership for:
   - `CatalogContract`
   - `GatewayHealthContract`
   - `GatewayRuntimeSnapshot`
   - `ExecuteRequest`
   - `ExecuteResponse`
   - `PolicyDecision`
   - `ResultEnvelope`
   - `TurnContext`
2. Keep the current live compatibility floor explicit while those target contracts are introduced:
   - `/health`
   - `/tools`
   - `/call-tool`
   - hidden request-layer injection
   - invalid-turn enforcement
   - startup/history rescan
   - execute / insert / send behavior
3. Limit implementation work to:
   - `packages/protocol/*`
   - narrow route/request/response adapters
   - consumers that must align with the shared contract vocabulary
   - target-owner scaffolding under `apps/extension/src/chatgpt-adapter/*` when it prevents page-fact truth from staying scattered in `apps/userscript/src/*`
   - target-owner scaffolding under `apps/extension/src/injection-runtime/*` when it prevents injection mode/status semantics from staying duplicated across userscript state and request-hook code
   - target-owner scaffolding under `apps/extension/src/operator-panel/*` when it prevents runtime snapshot semantics from staying userscript-local
   - target-owner scaffolding under `apps/extension/src/turn-runtime/*` when it prevents invalid-turn state and auto-round guard semantics from staying duplicated in userscript-only helpers
   - contract and repo docs
   - materialized `/tools` metadata that carries the Phase 1 catalog contract without breaking current consumers
4. Centralize ChatGPT Web runtime evidence in one durable doc:
   - `docs/operations/chatgpt-web-runtime-evidence.md`
   - use it as the only source of raw DOM/request-shape/selectors evidence
   - make neighboring docs reference it instead of repeating the same facts
5. Centralize ChatGPT Web page-fact code truth in one v0.9 owner:
   - `apps/extension/src/chatgpt-adapter/*`
   - keep current userscript modules on thin compat re-exports instead of minting fresh local copies
6. Avoid opening:
   - extension shell migration
   - gateway kernel extraction
   - proposal workflow rollout
   - mode rollout
   - external MCP rollout
   - broad builtin capability expansion

Definition of done for this stage:

- the first slice is concrete enough that Codex can start work from the repo docs alone
- shared contract names and minimum surfaces are stable in docs
- shared contract names and minimum surfaces are seeded in `packages/protocol` with schemas/tests, not only described in docs
- the first implementation work can begin in `packages/protocol` and narrow adapters without reopening scope
- the docs clearly say which current runtime contracts remain canonical during the freeze
- ChatGPT Web DOM/request-shape evidence has a single maintained home before any DOM-heavy slice expands
- ChatGPT Web page-fact constants and helpers have a single v0.9 target owner before broader extension extraction starts

## Stage 4: Execute The First Compat-Preserving Core Slice

Status: completed

- Implement the Phase 1 shared-contract freeze defined above.
- Keep current live behavior stable or explicitly migrated with updated docs and verification.
- Use the v0.9 architecture ring discipline instead of mixing core extraction, mode rollout, and capability expansion in one pass.
- Current execution inside this stage:
  - shared protocol compat helpers for current single-call bridge request/response shapes
  - shared `GatewayHealthContract` plus browser-local `GatewayRuntimeSnapshot`, so userscript health/catalog state no longer relies on a loose local `/health` type or split catalog provenance fields
  - nested `/call-tool` `execute` metadata that preserves the legacy top-level `result`
  - removal of transition-only flat top-level execute-metadata parsing, so compat effort stays aligned to the live runtime floor instead of draft carryover
  - userscript request construction and execute-metadata reading moved onto shared helpers
  - userscript now treats nested `execute` metadata as required on the live `/call-tool` path instead of silently accepting malformed mixed-version payloads
  - shared protocol now separates raw `/call-tool` boundary payload typing from the validated live response type used by gateway/userscript runtime code
  - userscript `/tools` fetching now validates the full live `CatalogContract` before reading `tools[]`
  - userscript cache/bootstrap/runtime state now retain the full catalog contract instead of only `tools[]`
  - userscript state/UI now distinguish live gateway catalog provenance from cached bootstrap provenance
  - single-result insertion now formats shared inline/error result envelopes instead of inserting raw legacy single-call payloads
  - shared batch result-envelope items and helper, with userscript batch assembly and result formatting consuming the shared envelope shape
  - app-local validation scripts that rebuild required workspace package outputs before `lint`, `test`, or `build`

Initial likely implementation surfaces:

- `packages/protocol/*`
- `apps/gateway/src/routes/*`
- current userscript protocol consumers
- contract-focused tests
- `apps/extension/src/chatgpt-adapter/*`
- `apps/extension/src/injection-runtime/*`
- `apps/extension/src/operator-panel/*`
- `apps/extension/src/turn-runtime/*`

Definition of done reached:

- the current userscript/gateway live runtime floor now consumes shared contract surfaces instead of parallel local shape definitions for catalog, health, execute metadata, and result envelopes
- Phase 1 target-owner seeding now covers:
  - `apps/extension/src/chatgpt-adapter/*` for page facts
  - `apps/extension/src/injection-runtime/*` for request-injection mode/status helper semantics
  - `apps/extension/src/operator-panel/*` for runtime-snapshot helper semantics
  - `apps/extension/src/turn-runtime/*` for invalid-turn state, pending-selection identity, and auto-round guard helper semantics
- root `pnpm lint`, `pnpm test`, and `pnpm build` all pass after the completed Phase 1 slice

## Stage 5: Define The Phase 2 Module-By-Module Program

Status: completed

- Decide the first post-Phase-1 execution model before opening broader capability work.
- Keep Phase 2 inside Final Core unless task docs are deliberately retargeted.
- Decision reached: Phase 2 is a module-by-module refactor program across `apps/extension` and `apps/gateway`.
- Primary battleground ring: Final Core.
- Primary axis: extension runtime boundary extraction.
- Phase 2 execution rule:
  - one stage equals one module
  - only one module stage is active at a time
  - optimize logic, timing, and stability inside the active module before opening the next one
- Phase 2 target:
  - complete `apps/extension` and `apps/gateway` through ordered module stages
  - treat userscript as a reference baseline only, not as a target compat shell that must survive the migration
  - prefer direct extension + gateway implementation when that improves timing, logic, or ownership boundaries
- Phase 2 must not expand into:
  - `reviewed` / `yolo` rollout
  - proposal or external MCP capability work
  - multiple active module stages in parallel

## Stage 6: Phase 2 Module Order

Status: pending

- Use this order unless current truth forces an explicit resequencing:
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
- `chatgpt-adapter` stays as a shared dependency surface that may receive supporting updates during earlier stages, but Phase 2 should not reopen it as a separate primary module stage unless runtime evidence shows that current page-fact ownership is insufficient.
- Resequence only when the active module reveals a hard dependency that would materially improve stability or validation order.

## Stage 7: Execute Module Stage - Turn Runtime

Status: in progress

- Implement the current `turn-runtime` module stage without opening a second active module.
- Preserve the current proven browser-runtime floor while shifting long-term ownership away from userscript.
- Treat this stage as a complete module refactor, not as permission to absorb neighboring modules.
- Use userscript as behavior evidence, not as a required intermediate landing zone for new long-term code.

Concrete work in this stage:

1. Move parser-level turn analysis and normalization behind extension-owned seams:
   - `apps/extension/src/turn-runtime/*`
   - `apps/userscript/src/parser.ts` becomes a thin temporary adapter only if still needed by the live baseline
2. Tighten latest-open-turn detection and startup/history rescan ownership so the turn-runtime flow no longer lives primarily inside `apps/userscript/src/chatgpt-mcp-bridge.user.ts`.
3. Keep duplicate guard, invalid-turn blocking, and pending-selection behavior aligned with the extension `turn-runtime` owner instead of scattering fresh logic back into userscript files.
4. Allow narrow supporting changes outside `turn-runtime` only when they are strictly required to complete the `turn-runtime` module with cleaner timing or validation.
5. Update tests and task docs around the actual active module stage:
   - userscript parser / detection / round-guard tests
   - any new extension-side tests needed to make the ownership shift explicit
   - root task-control docs
6. Avoid opening:
   - `result-delivery` as a primary module stage
   - `injection-runtime` as a primary module stage
   - gateway execution-kernel extraction as a primary module stage
   - proposal flow
   - mode rollout
   - panel feature expansion unrelated to extraction
   - broad delivery-path redesign

Initial likely implementation surfaces:

- `apps/extension/src/turn-runtime/*`
- `apps/userscript/src/parser.ts`
- `apps/userscript/src/chatgpt-mcp-bridge.user.ts`
- `apps/userscript/src/detection-state.ts`
- `apps/userscript/src/round-guard.ts`
- current userscript tests covering turn parsing and duplicate guard
- root task-control docs

Definition of done for this stage:

- parser-level turn normalization no longer lives as long-term truth in `apps/userscript/src/parser.ts`
- latest-open-turn detection plus startup/history rescan no longer depend on userscript owning the full turn-runtime story
- invalid-turn blocking and duplicate guard behavior remain stable on the live runtime path
- hidden injection, execute / insert / send behavior, and result delivery do not regress as collateral damage from the extraction
- userscript is no longer treated as a required target shell for the new architecture; long-term logic lands in extension + gateway owners directly
- root `pnpm lint`, `pnpm test`, and `pnpm build` all pass after the Phase 2 slice
- at least one real ChatGPT Web validation pass confirms the proven runtime baseline still works after the ownership shift

## Stage 8: Execute Module Stage - Result Delivery

Status: pending

- Make `apps/extension/src/result-delivery/*` the long-term owner of result formatting, insertion, send timing, and recovery semantics.
- Keep execution meaning, policy meaning, and runtime detection separate from delivery logic.
- Do not open gateway-kernel or proposal flow while this stage is active.

## Stage 9: Execute Module Stage - Injection Runtime

Status: pending

- Finish `apps/extension/src/injection-runtime/*` as the long-term owner of catalog bootstrap, hidden injection payload construction, and injection-state timing.
- Keep current hidden request-layer behavior stable while reducing userscript-local orchestration.

## Stage 10: Execute Module Stage - Operator Panel

Status: pending

- Finish `apps/extension/src/operator-panel/*` as the long-term owner of runtime display, operator intents, and diagnostics entrypoints.
- Avoid turning panel work into a second execution state machine.

## Stage 11: Execute Module Stage - Execution Kernel

Status: pending

- Make `apps/gateway/src/execution-kernel/*` the only execution orchestration entrypoint.
- Keep route behavior stable while moving orchestration behind the kernel.

## Stage 12: Execute Module Stage - Tool Registry

Status: pending

- Make `apps/gateway/src/tool-registry/*` the catalog truth owner.
- Keep `/tools` stable while separating registry concerns from policy and execution.

## Stage 13: Execute Module Stage - Tool Policy

Status: pending

- Make `apps/gateway/src/tool-policy/*` the explicit decision layer.
- Keep allow/deny/proposal semantics stable while removing scattered policy logic.

## Stage 14: Execute Module Stage - Builtin Tools

Status: pending

- Consolidate builtin tool implementations under `apps/gateway/src/builtin-tools/*`.
- Keep tool behavior stable while reducing route-level or orchestration-level leakage.

## Stage 15: Execute Module Stage - Shell Runtime

Status: pending

- Make `apps/gateway/src/shell-runtime/*` the single owner for shell execution semantics.
- Keep `run_task` / `run_pwsh` timing and safety behavior explicit without reopening product-scope debate.

## Stage 16: Execute Module Stage - Audit Log

Status: pending

- Move audit ownership into `apps/gateway/src/audit-log/*`.
- Keep logging truthful and structured without turning this stage into broad diagnostics redesign.

## Stage 17: Execute Module Stage - Diagnostics

Status: pending

- Move diagnostics ownership into `apps/gateway/src/diagnostics/*`.
- Keep operator-facing and developer-facing runtime truth intact while separating diagnostics from core execution logic.

## Risks

- The codebase still implements the proven userscript-first runtime, so the target docs are ahead of the structure.
- Hidden request-layer injection, invalid-turn enforcement, and result delivery are still real-page behaviors; browser-only regressions cannot be dismissed by passing unit tests alone.
- Phase 2 can still sprawl if multiple module stages are opened at once or if stage boundaries are ignored once a refactor gains momentum.
- The repo still lacks browser-driven end-to-end automation, so major browser-runtime transitions will continue to depend on real ChatGPT Web manual verification.
