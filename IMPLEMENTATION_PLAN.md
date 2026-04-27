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

Status: in progress

- Implement the Phase 1 shared-contract freeze defined above.
- Keep current live behavior stable or explicitly migrated with updated docs and verification.
- Use the v0.9 architecture ring discipline instead of mixing core extraction, mode rollout, and capability expansion in one pass.
- Current execution inside this stage:
  - shared protocol compat helpers for current single-call bridge request/response shapes
  - nested `/call-tool` `execute` metadata that preserves the legacy top-level `result`
  - removal of transition-only flat top-level execute-metadata parsing, so compat effort stays aligned to the live runtime floor instead of draft carryover
  - userscript request construction and execute-metadata reading moved onto shared helpers
  - single-result insertion now formats shared inline/error result envelopes instead of inserting raw legacy single-call payloads
  - shared batch result-envelope items and helper, with userscript batch assembly and result formatting consuming the shared envelope shape
  - app-local validation scripts that rebuild required workspace package outputs before `lint`, `test`, or `build`

Initial likely implementation surfaces:

- `packages/protocol/*`
- `apps/gateway/src/routes/*`
- current userscript protocol consumers
- contract-focused tests

## Risks

- The codebase still implements the proven userscript-first runtime, so the target docs are ahead of the structure.
- Hidden request-layer injection, invalid-turn enforcement, and result delivery are still real-page behaviors; browser-only regressions cannot be dismissed by passing unit tests alone.
- The first v0.9 slice can sprawl if boundary extraction, mode rollout, and capability expansion are mixed together.
- The repo still lacks browser-driven end-to-end automation, so major browser-runtime transitions will continue to depend on real ChatGPT Web manual verification.
