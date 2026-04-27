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

## Stage 5: Define The Phase 2 Extraction Slice

Status: completed

- Decide the first post-Phase-1 extraction-focused slice before opening broader capability work.
- Keep the next slice inside Final Core unless task docs are deliberately retargeted.
- Decision reached: Phase 2 is a larger but still single-axis `turn-runtime` extraction package.
- Primary battleground ring: Final Core.
- Primary axis: extension runtime boundary extraction.
- Phase 2 target:
  - move parser-level turn normalization and nearby turn-runtime orchestration behind `apps/extension/src/turn-runtime/*`
  - keep userscript as a compat shell rather than the long-term turn-runtime owner
- Phase 2 must not expand into:
  - gateway execution-kernel extraction
  - `result-delivery` as a separate broad battleground
  - operator-panel feature expansion
  - `reviewed` / `yolo` rollout
  - proposal or external MCP capability work

## Stage 6: Execute Phase 2 Turn-Runtime Extraction

Status: pending

- Implement the chosen Phase 2 slice without opening a second structural axis.
- Preserve the current proven browser-runtime floor while shifting long-term ownership away from userscript.
- Treat this stage as a bigger same-axis package for efficiency, not as permission to mix multiple slices.

Concrete work in this stage:

1. Move parser-level turn analysis and normalization behind extension-owned seams:
   - `apps/extension/src/turn-runtime/*`
   - `apps/userscript/src/parser.ts` becomes compat wiring or a thin adapter only if still needed
2. Tighten latest-open-turn detection and startup/history rescan ownership so the turn-runtime flow no longer lives primarily inside `apps/userscript/src/chatgpt-mcp-bridge.user.ts`.
3. Keep duplicate guard, invalid-turn blocking, and pending-selection behavior aligned with the extension `turn-runtime` owner instead of scattering fresh logic back into userscript files.
4. Update tests and task docs around the actual Phase 2 battleground:
   - userscript parser / detection / round-guard tests
   - any new extension-side turn-runtime tests needed to make the ownership shift explicit
   - root task-control docs
5. Avoid opening:
   - gateway execution-kernel extraction
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
- root `pnpm lint`, `pnpm test`, and `pnpm build` all pass after the Phase 2 slice
- at least one real ChatGPT Web validation pass confirms the proven runtime baseline still works after the ownership shift

## Risks

- The codebase still implements the proven userscript-first runtime, so the target docs are ahead of the structure.
- Hidden request-layer injection, invalid-turn enforcement, and result delivery are still real-page behaviors; browser-only regressions cannot be dismissed by passing unit tests alone.
- Phase 2 can still sprawl if turn-runtime extraction, result-delivery extraction, and gateway redesign are mixed together.
- The repo still lacks browser-driven end-to-end automation, so major browser-runtime transitions will continue to depend on real ChatGPT Web manual verification.
