# Current Scope Spec

Current boundary: as of April 27, 2026, the v0.1 real-page stop line is closed. This file now tracks the active v0.9 mainline scope. `docs/prd.md` remains the closed v0.1 reference baseline; [docs/v0.9-entrypoint.md](docs/v0.9-entrypoint.md) and [docs/prd_vnext.md](docs/prd_vnext.md) are the active target-state entry docs.

## Goal

Turn the proven v0.1 userscript + gateway baseline into the real v0.9 product target: ChatGPT Web Local Agent Bridge, while keeping the current live runtime contracts explicit until each one is intentionally migrated or replaced.

## Current Slice

Phase 1 shared-contract freeze is complete. No later extraction or capability slice is open yet.

That completed slice exists so Codex could start concrete work without reopening the whole v0.9 surface at once.

Primary battleground:

- shared contracts and narrow runtime adapters

Primary file surfaces:

- `packages/protocol/*`
- current gateway route shapes under `apps/gateway/src/routes/*`
- current userscript request/result call sites that consume protocol types
- `apps/extension/src/chatgpt-adapter/*`
- `apps/extension/src/injection-runtime/*`
- `apps/extension/src/operator-panel/*`
- `apps/extension/src/turn-runtime/*`
- `docs/protocols/*`
- `docs/operations/chatgpt-web-runtime-evidence.md`
- the root task-control docs

## Slice Intent

Define one shared contract vocabulary for the future extension runtime and gateway kernel before any large extraction work begins.

At minimum, this slice should make it possible to implement against a stable target for:

- catalog truth
- gateway health truth
- browser-local runtime snapshot truth
- execution request/response
- policy decisions
- result envelopes
- turn context and operator intent

## In Scope

- Promote the v0.9 doc pack from planning-only material to the active repo mainline truth.
- Keep the current live runtime behavior documented in `docs/prd.md` as the migration floor rather than the active product target.
- Preserve current live contracts during early v0.9 work unless a migration path is explicitly documented:
  - `/health`
  - `/tools`
  - `/call-tool`
  - hidden request-layer injection
  - invalid-turn enforcement
  - startup/history rescan
  - execute / insert / send runtime semantics
- Define and sequence the first concrete v0.9 delivery slice instead of treating all target-state capabilities as equally active at once.
- Keep `docs/operations/*` and `docs/protocols/*` truthful for both:
  - the current proven runtime baseline
  - the target-state architecture and migration constraints
- Update root task-control docs whenever the active v0.9 slice, gate, or sequencing truth changes.
- Define the concrete Phase 1 shared-contract freeze so implementation can start without guessing the first slice.
- Freeze target names and minimum payload surfaces for:
  - `CatalogContract`
  - `GatewayHealthContract`
  - `GatewayRuntimeSnapshot`
  - `ExecuteRequest`
  - `ExecuteResponse`
  - `PolicyDecision`
  - `ResultEnvelope`
  - `TurnContext`
- Clarify which current live payloads remain canonical during the freeze and which future fields may be added compatibly.
- Treat draft v0.9 docs and draft contract surfaces as reference/target truth, not as compatibility obligations by themselves. Compatibility effort in this slice belongs to the current live runtime floor, not to preserving interim draft wording.
- Limit early implementation work to shared contracts, route adapters, and contract-consumer alignment.
- Establish `docs/operations/chatgpt-web-runtime-evidence.md` as the only allowed repository source for ChatGPT Web DOM/request-shape/selectors evidence.
- Establish `apps/extension/src/chatgpt-adapter/` as the canonical v0.9 code owner for ChatGPT Web page facts, with current userscript code consuming those facts only through compatibility wiring.
- Allow narrow `apps/extension/src/injection-runtime/*` target-owner scaffolding when it removes duplicated request-injection mode/status semantics without opening broader request-hook extraction.
- Allow narrow `apps/extension/src/operator-panel/*` target-owner scaffolding when it removes userscript-local runtime snapshot semantics without opening panel feature rollout or a second execution state machine.
- Allow narrow `apps/extension/src/turn-runtime/*` target-owner scaffolding when it removes duplicated invalid-turn state, pending-selection identity, or auto-round guard semantics without opening broad turn-runtime extraction.

## Out of Scope

- Reopening v0.1 as the active product target.
- Pretending v0.9 is already shipped because the target docs are mature.
- Breaking the current userscript + gateway baseline without an explicit migration and re-verification plan.
- Broad capability rollout such as:
  - full proposal workflow
  - `reviewed` / `yolo` execution rollout
  - `run_pwsh` shipping
  - external/custom MCP rollout
  - extension-first shell migration
- DOM-heavy runtime rewrites based on unrecorded or scattered page observations.
- Multi-platform browser AI support.
- Session management as a primary product line.
- Automatic remote MCP execution as the default workflow.
- Store, analytics, remote config, or marketplace work as the mainline.

## Constraints

- On April 27, 2026, the user confirmed live signed-in ChatGPT Web acceptance and formally closed the v0.1 stop line.
- `docs/prd.md` is now a closed reference baseline: useful for current runtime truth, but no longer the active product target.
- Root `SPEC.md`, `IMPLEMENTATION_PLAN.md`, and `TASK_STATUS.md` now track the active v0.9 program, not the old v0.1 close-out loop.
- Draft-marked v0.9 docs remain editable target-state references. They do not create extra compatibility obligations unless the current live runtime or task-control docs explicitly adopt the relevant field/path/behavior as part of the active floor.
- No v0.9 slice may silently invalidate a current live contract or runtime guarantee without:
  - updated product and migration docs
  - a replacement path
  - re-verification on the real ChatGPT page when browser runtime behavior is affected
- The current compatibility floor must remain stable during this slice:
  - `/health`
  - `/tools`
  - `/call-tool`
  - hidden request-layer injection
  - invalid-turn enforcement
  - startup/history rescan
  - execute / insert / send runtime semantics
- ChatGPT Web DOM/request-shape facts must be recorded in `docs/operations/chatgpt-web-runtime-evidence.md` rather than duplicated across multiple docs.
- ChatGPT Web page-fact constants and helpers must converge into `apps/extension/src/chatgpt-adapter/` rather than being redefined inside `apps/userscript/src/*`.
- Verification must remain reproducible from the repo root whenever code changes are made.

## Acceptance Criteria

- Root task-control docs consistently state that v0.1 closed on April 27, 2026 and now serves as a reference baseline only.
- `docs/v0.9-entrypoint.md`, `docs/prd_vnext.md`, and the root task docs all agree that v0.9 is the active mainline.
- The first active v0.9 delivery slice is explicit enough that Codex can begin implementation without asking which subsystem opens first.
- `IMPLEMENTATION_PLAN.md` contains concrete stage goals, battleground, and file surfaces for the current slice.
- The current runtime contracts that must survive early migration work are clearly enumerated in repo docs.
- No active task-control or v0.9 entry doc still says that v0.1 close-out is blocking v0.9 by default.
- The active slice clearly limits itself to contract freeze and narrow adapters instead of broad new capabilities.
- The repo has one explicit source of truth for ChatGPT Web DOM/request-shape evidence, and the task docs point to it instead of duplicating its content.
- The repo has one explicit v0.9 code owner for ChatGPT Web page facts, and current userscript modules consume it through compat wiring instead of redefining the same constants locally.
