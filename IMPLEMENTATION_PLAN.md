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
   - target-owner scaffolding under `apps/extension/src/chatgpt-adapter/*`
   - target-owner scaffolding under `apps/extension/src/injection-runtime/*`
   - target-owner scaffolding under `apps/extension/src/operator-panel/*`
   - target-owner scaffolding under `apps/extension/src/turn-runtime/*`
   - contract and repo docs
   - materialized `/tools` metadata that carries the Phase 1 catalog contract without breaking current consumers
4. Centralize ChatGPT Web runtime evidence in one durable doc:
   - `docs/operations/chatgpt-web-runtime-evidence.md`
5. Centralize ChatGPT Web page-fact code truth in one v0.9 owner:
   - `apps/extension/src/chatgpt-adapter/*`
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
  - shared `GatewayHealthContract` plus browser-local `GatewayRuntimeSnapshot`
  - nested `/call-tool` `execute` metadata that preserves the legacy top-level `result`
  - removal of transition-only flat top-level execute-metadata parsing
  - userscript request construction and execute-metadata reading moved onto shared helpers
  - userscript now treats nested `execute` metadata as required on the live `/call-tool` path
  - shared protocol now separates raw `/call-tool` boundary payload typing from the validated live response type used by gateway and userscript runtime code
  - userscript `/tools` fetching now validates the full live `CatalogContract` before reading `tools[]`
  - userscript cache/bootstrap/runtime state now retain the full catalog contract instead of only `tools[]`
  - userscript state and UI now distinguish live gateway catalog provenance from cached bootstrap provenance
  - single-result insertion now formats shared inline and error result envelopes instead of inserting raw legacy single-call payloads
  - shared batch result-envelope items and helper, with userscript batch assembly and result formatting consuming the shared envelope shape
  - app-local validation scripts that rebuild required workspace package outputs before `lint`, `test`, or `build`

Definition of done reached:

- the current userscript and gateway live runtime floor now consumes shared contract surfaces instead of parallel local shape definitions for catalog, health, execute metadata, and result envelopes
- Phase 1 target-owner seeding now covers:
  - `apps/extension/src/chatgpt-adapter/*`
  - `apps/extension/src/injection-runtime/*`
  - `apps/extension/src/operator-panel/*`
  - `apps/extension/src/turn-runtime/*`
- root `pnpm lint`, `pnpm test`, and `pnpm build` all pass after the completed Phase 1 slice

## Stage 5: Define The Phase 2 Module-By-Module Program

Status: completed

- Decide the first post-Phase-1 execution model before opening broader capability work.
- Keep Phase 2 inside Final Core unless task docs are deliberately retargeted.
- Decision reached: Phase 2 is a module-by-module refactor program across `apps/extension` and `apps/gateway`.
- Primary battleground ring: Final Core.
- Primary axis: extension runtime boundary extraction first, then gateway boundary extraction.
- Phase 2 execution rule:
  - one stage equals one module
  - only one module stage is active at a time
  - optimize logic, timing, stability, and validation coverage inside the active module before opening the next one
- Phase 2 target:
  - complete `apps/extension` and `apps/gateway` through ordered module stages
  - treat userscript as a reference baseline only, not as a target compat shell that must survive the migration
  - prefer direct extension + gateway implementation when that improves timing, logic, or ownership boundaries
- Phase 2 must not expand into:
  - `reviewed` / `yolo` rollout
  - proposal or external MCP capability work
  - multiple active module stages in parallel

## Stage 6: Lock The Phase 2 Module Order And Rationale

Status: completed

Declared module order:

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

Why this order (items 1-11):

- `turn-runtime` first because the current assistant-turn normalization, invalid-turn handling, duplicate guard, and startup/history rescan semantics still shape the rest of the browser runtime.
- `result-delivery` second because delivery must consume a stable normalized-turn and result-envelope path before injection and panel cleanup can stay narrow.
- `injection-runtime` third because bootstrap timing and hidden injection diagnostics depend on the surrounding turn and delivery contracts being clearer first.
- `operator-panel` fourth because the panel should observe runtime owners after the runtime surfaces exist, not define them prematurely.
- `execution-kernel` fifth because the browser-side runtime seams should be clearer before gateway execution orchestration becomes the next primary battleground.
- `tool-registry` and `tool-policy` follow the kernel because catalog truth and decision truth should be split after the unique execution entrypoint exists.
- `builtin-tools` follows registry and policy so implementations can settle behind clearer registration and decision boundaries.
- `shell-runtime` follows builtin tool cleanup so shell behavior stays the power-tool plane instead of becoming the default escape hatch.
- `audit-log` follows execution, policy, and shell ownership so audit events can describe stable concepts instead of moving targets.
- `diagnostics` comes last because it must aggregate the real final-core truths rather than freezing interim wiring.

Why this order (items 12-15):

- `package-domain-extraction` first among the new stages because the domain model packages (`turn-model`, `tool-contracts`, `policy-model`, `result-model`, `shared-utils`, `test-fixtures`) must stabilize before extension and gateway restructure their boundaries around them. Deleting `packages/protocol/` and updating all consumer imports is a single atomic operation that cannot be split across stages without leaving the build broken.
- `extension-structure` second because completing the Chrome Extension shell with a real manifest v3, background service worker, content script entrypoint, and `main/` composition root is a prerequisite for removing the userscript — the browser runtime must have a verified replacement before the old shell is archived.
- `gateway-structure` third because the gateway can complete its final module layout (`api/`, `proposal-engine/`, `external-mcp/`, `result-cache/`, `main/`) once the shared packages are stable, and the gateway does not depend on the extension shell being complete.
- `remove-compat-layers` last because all compat re-exports in `apps/gateway/src/routes/`, `tools/`, `security/`, `shell/`, `utils/` and the entire `apps/userscript/` package can only be deleted after every consumer has been migrated to the proper owners — this stage is the final cleanup that confirms the target structure is the only structure.

Resequencing rule:

- resequence only when the active module reveals a hard dependency that would materially improve stability or validation order
- any resequencing must update `SPEC.md`, `IMPLEMENTATION_PLAN.md`, and `TASK_STATUS.md` together before code work proceeds

## Phase 2 Stage Execution Rules

These rules apply to every Stage 7 through Stage 21 slice:

- The active stage owns one target module plus only the supporting seams needed to land it safely.
- Supporting seams may include:
  - current userscript compat files
  - current gateway composition roots
  - shared contracts in `packages/protocol/*`
  - runtime evidence and task-control docs
- Supporting seams must not become the first home of new long-term behavior.
- Each stage should explicitly improve:
  - ownership clarity
  - runtime timing and sequencing
  - failure isolation and stability
  - direct testability
- Required validation layers for every stage:
  - direct tests for the owner module or extracted pure helpers
  - regression tests for the still-live compat path
  - root `pnpm lint`, `pnpm test`, and `pnpm build`
  - real ChatGPT Web validation for stages that affect browser runtime timing, DOM interaction, injection, turn detection, insertion, send behavior, or operator-visible recovery
- If a stage changes a still-live compatibility-floor route such as `/health`, `/tools`, or `/call-tool`, rerun the matching userscript-side regression coverage and at least one browser-to-gateway consumer-path validation before calling the stage done.
- Any stage that includes UI or UX design work must use the `ui-ux-pro-max` skill first. Follow its required `--design-system` step before implementation or redesign decisions, and default to the skill's `html-tailwind` stack guidance unless the stage explicitly names another stack.
- A stage is not complete if its logic moved but its verification remained indirect or purely incidental.
- If a stage reveals unresolved cross-module ambiguity, stop and rewrite the stage boundary in docs before widening the code change.

## Stage 7: Execute Module Stage - Turn Runtime

Status: completed

Goal:

- make `apps/extension/src/turn-runtime/*` the long-term owner for assistant-turn normalization, invalid-turn classification, duplicate guard, latest-open-turn selection, startup/history rescan, and turn-context shaping that feeds later execution requests without absorbing gateway orchestration

Target owner surfaces:

- `apps/extension/src/turn-runtime/*`

Expected current source and compat surfaces:

- `apps/userscript/src/parser.ts`
- `apps/userscript/src/chatgpt-mcp-bridge.user.ts`
- `apps/userscript/src/detection-state.ts`
- `apps/userscript/src/round-guard.ts`
- `apps/userscript/src/turn-runtime.ts`
- `apps/userscript/src/pending-turn-detection.test.ts`
- `apps/userscript/src/parser.test.ts`
- `apps/userscript/src/detection-state.test.ts`
- `apps/userscript/src/round-guard.test.ts`
- `docs/operations/chatgpt-web-runtime-evidence.md`

Optimization targets:

- remove parser-level turn normalization from long-term userscript ownership
- shrink `chatgpt-mcp-bridge.user.ts` around startup/history rescan orchestration
- make latest-open-turn selection and placeholder-turn skipping easier to reason about and test
- keep invalid-turn and duplicate-guard behavior stable while making the owner semantics more direct

Stage constraints:

- do not open `result-delivery`, `injection-runtime`, or gateway extraction as new primary stages
- allow `chatgpt-adapter` support edits only when new page facts are required and recorded in runtime evidence first
- keep result insertion, send behavior, and gateway execution semantics on compat paths unless strictly required to preserve the current turn-runtime flow

Required validation:

- `pnpm --filter @cwmb/userscript lint`
- `pnpm --filter @cwmb/userscript test`
- `pnpm --filter @cwmb/userscript build`
- targeted regression coverage for parser, pending-turn detection, invalid-turn state, and round guard
- root `pnpm lint`, `pnpm test`, and `pnpm build`
- at least one real ChatGPT Web validation pass for invalid-turn blocking plus startup/history rescan before claiming the stage complete

Definition of done:

- parser-level turn normalization no longer lives as long-term truth in `apps/userscript/src/parser.ts`
- latest-open-turn detection and startup/history rescan no longer depend on userscript owning the full turn-runtime story
- invalid-turn blocking and duplicate-guard behavior remain stable on the live runtime path
- the extension owner can be tested directly without routing every assertion through the userscript monolith

Definition of done reached:

- `apps/extension/src/turn-runtime/turn-runtime-poll.ts` now owns current-request identity resolution plus latest-assistant turn scan orchestration for clear, pending, invalid-waiting, and invalid runtime outcomes, so `apps/userscript/src/chatgpt-mcp-bridge.user.ts` no longer owns that decision pipeline.
- Direct owner-level tests now cover the new turn-runtime poll helper alongside parser, pending-turn detection, assistant-turn scan, turn-source, invalid-turn state, and pending-runtime helpers.
- `pnpm --filter @cwmb/userscript lint`, `test`, and `build` plus root `pnpm lint`, `pnpm test`, and `pnpm build` all succeeded after the Stage 7 close-out slice.
- The current dialogue-level acceptance summary for April 27, 2026 records the bridge chain, batch behavior, workspace read/search/grep tools, security boundaries, protocol alignment, and real write/UI end-to-end usage as currently usable with no remaining blocker reported for Stage 7 close-out.

## Stage 8: Execute Module Stage - Result Delivery

Status: complete

Goal:

- make `apps/extension/src/result-delivery/*` the long-term owner for result formatting, composer insertion, auto-send timing, and retry or copy fallback semantics

Target owner surfaces:

- `apps/extension/src/result-delivery/*`

Expected current source and compat surfaces:

- `apps/userscript/src/inserter.ts`
- `apps/userscript/src/batch.ts`
- `apps/userscript/src/preview.ts`
- `apps/userscript/src/chatgpt-mcp-bridge.user.ts`
- `apps/userscript/src/inserter.test.ts`
- `apps/userscript/src/batch.test.ts`
- `apps/userscript/src/preview.test.ts`
- `apps/userscript/src/ui.test.ts`
- `packages/protocol/src/*` only if delivery consumes new shared result-envelope helpers

Optimization targets:

- separate delivery semantics from turn detection and gateway execution meaning
- make single-result and batch-result delivery share one owner model
- reduce insertion and auto-send timing ambiguity, especially around failure and retry states
- ensure a valid result is never discarded just because insertion or send failed

Stage constraints:

- do not turn delivery into a second execution state machine
- do not reinterpret policy or execution status beyond what delivery needs to present
- do not open `execution-kernel`, proposal, or broad panel redesign while this stage is active

Required validation:

- `pnpm --filter @cwmb/userscript lint`
- `pnpm --filter @cwmb/userscript test`
- `pnpm --filter @cwmb/userscript build`
- targeted regression coverage for insertion, batch formatting, preview rendering, and panel-facing delivery states
- root `pnpm lint`, `pnpm test`, and `pnpm build`
- real ChatGPT Web validation for insert-only, insert-plus-send, and insertion-failure recovery paths before claiming the stage complete

Definition of done:

- result formatting and delivery timing have one extension owner
- insertion failure preserves a recoverable result path
- auto-send remains a local delivery behavior rather than leaking into policy or execution-kernel logic
- userscript delivery files, if still present, act only as compat adapters or local shell wiring

Definition of done reached:

- `apps/extension/src/result-delivery/*` now owns result formatting, composer insertion timing, recovered-send confirmation, retry-window semantics, startup recovery normalization, batch delivery outcomes, and panel-facing delivery presentation semantics.
- `apps/userscript/src/chatgpt-mcp-bridge.user.ts`, `inserter.ts`, `preview.ts`, and `ui.ts` now act as compat/runtime wiring only; delivery-specific pure state and copy no longer hide in the userscript shell.
- Real signed-in ChatGPT Web validation passed for insert-only, insert-plus-send, insertion-failure recovery, `Send=off -> Send=on -> refresh`, truncated residue refresh recovery, and repeated identical conversation-request submissions.
- `pnpm --filter @cwmb/userscript lint`, `test`, and `build` plus root `pnpm lint`, `pnpm test`, and `pnpm build` all succeeded after the close-out slice.

## Stage 9: Execute Module Stage - Injection Runtime

Status: complete

Goal:

- finish `apps/extension/src/injection-runtime/*` as the owner for catalog bootstrap consumption, hidden injection payload construction, fallback visible injection, and injection diagnostics timing

Target owner surfaces:

- `apps/extension/src/injection-runtime/*`

Expected current source and compat surfaces:

- `apps/userscript/src/catalog.ts`
- `apps/userscript/src/catalog-cache.ts`
- `apps/userscript/src/request-hook.ts`
- `apps/userscript/src/request-injection-state.ts`
- `apps/userscript/src/gateway-client.ts`
- `apps/userscript/src/catalog.test.ts`
- `apps/userscript/src/catalog-cache.test.ts`
- `apps/userscript/src/request-hook.test.ts`
- `apps/userscript/src/request-injection-state.test.ts`
- `apps/userscript/src/gateway-client.test.ts`
- `docs/operations/chatgpt-web-runtime-evidence.md`

Optimization targets:

- make bootstrap-versus-live catalog timing explicit and diagnosable
- reduce first-message race risk between page send timing and catalog availability
- keep hidden injection as the primary path while making fallback behavior intentional and testable
- expose injection diagnostics without duplicating a second catalog truth

Current progress on April 28, 2026:

- `apps/extension/src/injection-runtime/catalog.ts` now owns hidden and visible prompt construction plus bootstrap/live prompt-sync diagnostics copy
- `apps/extension/src/injection-runtime/catalog-cache.ts` now owns browser-local bootstrap cache IO
- `apps/extension/src/injection-runtime/request-body-injection.ts` now owns request-payload mutation helpers, while current userscript request-hook code is reduced to a runtime transport shell
- real ChatGPT Web validation passed for first-send hidden injection, visible fallback behavior, injection diagnostics timing, and cold-start recovery after cache deletion
- on the warm-bootstrap path the operator did not visibly catch `Catalog src = Cached bootstrap` before live sync overtook it, but the hidden path still worked and no fallback-only dependency remained

Stage constraints:

- current live catalog truth must remain grounded in `/tools`
- do not treat visible or manual injection as the new mainline
- do not reopen turn parsing or result delivery as separate battlegrounds

Required validation:

- `pnpm --filter @cwmb/userscript lint`
- `pnpm --filter @cwmb/userscript test`
- `pnpm --filter @cwmb/userscript build`
- targeted regression coverage for bootstrap cache usage, live refresh, request-shape injection, and injection-state diagnostics
- root `pnpm lint`, `pnpm test`, and `pnpm build`
- real ChatGPT Web validation for first-message hidden injection, fallback behavior, and injection diagnostics before claiming the stage complete

Definition of done:

- bootstrap, live refresh, hidden injection, and fallback injection semantics have one extension owner
- injection timing assumptions are explicit and locally testable
- the stage does not leave catalog state split across multiple browser-local owners

## Stage 10: Execute Module Stage - Operator Panel

Status: complete

Goal:

- make `apps/extension/src/operator-panel/*` the long-term owner for runtime snapshot display, operator intents, and diagnostics entrypoints without creating a second execution architecture

Target owner surfaces:

- `apps/extension/src/operator-panel/*`

Expected current source and compat surfaces:

- `apps/userscript/src/state.ts`
- `apps/userscript/src/ui.ts`
- `apps/userscript/src/preview.ts`
- `apps/userscript/src/capabilities.ts`
- `apps/userscript/src/runtime-snapshot.ts`
- `apps/userscript/src/state.test.ts`
- `apps/userscript/src/ui.test.ts`
- `apps/userscript/src/preview.test.ts`
- `apps/userscript/src/runtime-snapshot.test.ts`
- `apps/userscript/src/capabilities.test.ts`
- `apps/userscript/src/operator-panel.test.ts`

Optimization targets:

- keep panel display and intent wiring downstream of the runtime owners
- make live-versus-cached gateway state, injection status, turn status, and delivery status coherent in one observer layer
- reduce panel-specific conditional logic inside the userscript monolith
- improve diagnostics readability without mutating execution truth

Stage constraints:

- panel code must not bypass runtime orchestration with raw gateway calls
- do not turn panel state into a hidden duplicate of turn, injection, or delivery state machines
- do not open broad UX redesign unrelated to Phase 2 extraction
- if the stage changes operator-panel information architecture, interaction design, or visual language, run the required `ui-ux-pro-max` `--design-system` workflow first and treat its output as the starting design contract rather than freehand UI restyling

Required validation:

- `pnpm --filter @cwmb/userscript lint`
- `pnpm --filter @cwmb/userscript test`
- `pnpm --filter @cwmb/userscript build`
- targeted regression coverage for runtime snapshot display, manual intents, diagnostics copy, and capability toggles that remain in scope
- root `pnpm lint`, `pnpm test`, and `pnpm build`
- real ChatGPT Web validation for operator-visible statuses and manual recovery actions before claiming the stage complete

Definition of done:

- operator-visible runtime truth is read from the proper runtime owners rather than reconstructed ad hoc in UI code
- manual run, retry, copy, or recovery intents flow through the same runtime contracts as automatic paths
- the panel remains an observer and intent surface, not an alternate control plane

Completed on April 28, 2026:

- `apps/extension/src/operator-panel/runtime-snapshot.ts`, `capabilities.ts`, and `panel-state.ts` now own the pure runtime snapshot display, capability gating, operator-visible status assembly, and collapsed-panel action availability rules consumed by the live panel.
- current userscript `state.ts`, `ui.ts`, `preview.ts`, `capabilities.ts`, and `runtime-snapshot.ts` now act as compat holders or DOM/render shells instead of remaining the long-term owner for panel-facing runtime truth.
- real ChatGPT Web validation passed for operator-visible runtime statuses, collapsed `Execute` / `Insert` / `Send` / `Continue` actions, and manual recovery affordances before the stage was closed.

## Stage 11: Execute Module Stage - Execution Kernel

Status: completed

Goal:

- make `apps/gateway/src/execution-kernel/*` the unique execution orchestration entrypoint for `/call-tool` and any later gateway execution path

Target owner surfaces:

- `apps/gateway/src/execution-kernel/*`

Expected current source and compat surfaces:

- `apps/gateway/src/routes/call-tool.ts`
- `apps/gateway/src/routes/call-tool.test.ts`
- `apps/gateway/src/tools/index.ts`
- `apps/gateway/src/utils/errors.ts`
- `apps/gateway/src/logger.ts`
- `packages/protocol/src/*` only if execution contracts need a narrow supporting refinement

Optimization targets:

- remove route-owned orchestration and batch coordination
- make result aggregation and execution metadata assembly occur in one gateway owner
- isolate executor selection from route wiring and tool implementation details
- make later policy, registry, audit, and diagnostics stages depend on one kernel seam instead of scattered call paths

Stage constraints:

- keep route behavior stable while moving orchestration behind the kernel
- do not open new browser runtime behavior while the gateway kernel is active
- do not mix proposal or external MCP rollout into this stage

Required validation:

- `pnpm --filter @cwmb/gateway lint`
- `pnpm --filter @cwmb/gateway test`
- `pnpm --filter @cwmb/gateway build`
- targeted regression coverage for single-call and batch `/call-tool` behavior
- matching userscript-side regression coverage for `/call-tool` consumer behavior
- root `pnpm lint`, `pnpm test`, and `pnpm build`
- at least one browser-to-gateway validation pass for the live `/call-tool` path before claiming the stage complete

Definition of done:

- all gateway execution flows pass through one kernel entrypoint
- route handlers stop owning coordination logic directly
- later gateway modules can depend on the kernel instead of duplicating orchestration rules

Completed on April 28, 2026:

- `apps/gateway/src/execution-kernel/execution-kernel.ts` now owns batch-first execution orchestration, executor selection, per-call decision assembly, inline-versus-batch result-envelope shaping, and legacy `/call-tool` compat response assembly.
- `apps/gateway/src/routes/call-tool.ts` now only performs auth, request validation, and delegation into the execution kernel.
- direct owner tests now cover single-call legacy compat behavior plus batch stop-on-failure and continue-on-failure coordination at the kernel seam.
- matching userscript-side batch regression coverage confirms current `/call-tool` consumers still aggregate live per-call responses correctly when each payload carries nested `execute` metadata.
- `pnpm --filter @cwmb/gateway lint`, `pnpm --filter @cwmb/gateway test`, `pnpm --filter @cwmb/gateway build`, and root `pnpm lint`, `pnpm test`, `pnpm build` succeeded again after the extraction.
- manual browser-to-gateway validation now also passed for the live `/call-tool` path, including single-call and batch execution, so the stage can close without reopening browser-runtime scope.

## Stage 12: Execute Module Stage - Tool Registry

Status: completed

Goal:

- make `apps/gateway/src/tool-registry/*` the owner for builtin and external tool aggregation, namespace resolution, and materialized catalog generation

Target owner surfaces:

- `apps/gateway/src/tool-registry/*`

Expected current source and compat surfaces:

- `apps/gateway/src/routes/tools.ts`
- `apps/gateway/src/routes/tools.test.ts`
- `apps/gateway/src/tools/index.ts`
- `apps/gateway/src/tools/mcp-list.ts`
- `apps/gateway/src/tools/mcp-list.test.ts`
- `apps/gateway/src/config.ts`
- `packages/protocol/src/schemas.ts`
- `packages/protocol/src/schemas.test.ts`

Optimization targets:

- make catalog truth materialized in one place instead of partly in route code and partly in tool lists
- keep `mcp_list`, `/tools`, and catalog metadata aligned from one owner
- reduce registry-policy leakage so callable visibility is easier to reason about and test

Stage constraints:

- do not move per-call allow or deny decisions into the registry
- keep `/tools` and `mcp_list` behavior stable unless an explicit migration path is documented
- do not use registry cleanup as an excuse to expand external MCP rollout

Required validation:

- `pnpm --filter @cwmb/gateway lint`
- `pnpm --filter @cwmb/gateway test`
- `pnpm --filter @cwmb/gateway build`
- targeted regression coverage for `/tools`, `mcp_list`, catalog metadata, and enabled-state alignment
- matching userscript-side regression coverage for catalog bootstrap, live refresh, and `/tools` consumption
- root `pnpm lint`, `pnpm test`, and `pnpm build`
- at least one browser-to-gateway validation pass for the live `/tools` path before claiming the stage complete

Definition of done:

- one gateway owner materializes the catalog
- `/tools`, `mcp_list`, and catalog metadata stay aligned without route-local duplication
- registry concerns are separated cleanly from policy and execution concerns

Completed on April 28, 2026:

- `apps/gateway/src/tool-registry/{catalog,registry}.ts` now owns builtin aggregation plus materialized catalog generation.
- `apps/gateway/src/routes/tools.ts` and `apps/gateway/src/tools/mcp-list.ts` now consume the same catalog owner seam instead of each materializing descriptors locally.
- direct gateway owner tests now cover catalog metadata materialization and enabled-only filtering, while matching userscript regressions still validate `/tools` contract consumption.
- `pnpm --filter @cwmb/gateway lint`, `pnpm --filter @cwmb/gateway test`, `pnpm --filter @cwmb/gateway build`, targeted userscript `/tools` regressions, and root `pnpm lint`, `pnpm test`, `pnpm build` succeeded again.
- live browser-to-gateway `/tools` validation passed after the owner shift, so the stage can close without reopening adjacent browser-runtime scope.

## Stage 13: Execute Module Stage - Tool Policy

Status: completed

Goal:

- make `apps/gateway/src/tool-policy/*` the explicit decision layer for current workspace hard policy, risk-aware decisions, and decision outputs that later mode-aware policy work can consume without reopening that rollout now

Target owner surfaces:

- `apps/gateway/src/tool-policy/*`

Expected current source and compat surfaces:

- `apps/gateway/src/security/path-policy.ts`
- `apps/gateway/src/security/path-policy.test.ts`
- `apps/gateway/src/security/sensitive-paths.ts`
- `apps/gateway/src/routes/call-tool.ts`
- `apps/gateway/src/routes/call-tool.test.ts`
- `apps/gateway/src/tools/write-file.ts`
- `apps/gateway/src/tools/write-file.test.ts`
- `apps/gateway/src/tools/write-file-proposal.ts`
- `docs/operations/security.md`
- `docs/operations/tool-policy.md`

Optimization targets:

- make allow, deny, and proposal-worthy decisions explicit instead of scattered
- keep workspace hard policy as the ceiling while leaving future mode-aware semantics as later dependent work
- reduce tool-local and route-local policy branching so policy behavior becomes testable as policy

Stage constraints:

- do not execute tools from policy code
- do not open full `reviewed` or `yolo` rollout unless task docs deliberately resequence the program
- do not let tool implementations become the hidden long-term source of decision rules

Required validation:

- `pnpm --filter @cwmb/gateway lint`
- `pnpm --filter @cwmb/gateway test`
- `pnpm --filter @cwmb/gateway build`
- targeted regression coverage for path policy, sensitive-path blocks, write gating, and route-visible decision outcomes
- matching userscript-side regression coverage for `/call-tool` consumer-visible decision and error behavior
- root `pnpm lint`, `pnpm test`, and `pnpm build`
- at least one browser-to-gateway validation pass if the stage changes live `/call-tool` decision semantics

Definition of done:

- policy rules have one gateway owner
- route handlers and builtin tools consume explicit policy outputs instead of re-deriving decisions locally
- the stage improves decision testability without widening product scope

Completed on April 28, 2026:

- `apps/gateway/src/tool-policy/{call-policy,path-policy}.ts` now owns pre-execution tool assessment, failure-to-decision mapping, workspace hard-path policy resolution, and blocked-path matching.
- `apps/gateway/src/execution-kernel/execution-kernel.ts` now consumes explicit tool-policy helpers instead of resolving enabled state, argument parsing, and failure-decision attribution locally.
- `apps/gateway/src/security/{path-policy,sensitive-paths}.ts` are now compat exports over the tool-policy owner, and `apps/gateway/src/tools/write-file.ts` now consumes write gating from the same policy owner instead of carrying that rule inline.
- direct owner tests now cover pre-execution allow/deny assessment plus workspace path policy, while route and userscript regressions preserve current `/call-tool` consumer-visible decision and error behavior.
- `pnpm --filter @cwmb/gateway lint`, `pnpm --filter @cwmb/gateway test`, `pnpm --filter @cwmb/gateway build`, targeted userscript `/call-tool` regressions, and root `pnpm lint`, `pnpm test`, `pnpm build` succeeded again.
- no new live browser validation was required to close this stage because the shipped `/call-tool` behavior stayed compat-stable; the change was ownership and testability, not a new operator-visible decision model.

## Stage 14: Execute Module Stage - Builtin Tools

Status: completed

Goal:

- consolidate builtin tool implementations under `apps/gateway/src/builtin-tools/*` with cleaner shared execution conventions

Target owner surfaces:

- `apps/gateway/src/builtin-tools/*`

Expected current source and compat surfaces:

- `apps/gateway/src/tools/read-file.ts`
- `apps/gateway/src/tools/read-file.test.ts`
- `apps/gateway/src/tools/list-directory.ts`
- `apps/gateway/src/tools/search-files.ts`
- `apps/gateway/src/tools/search-files.test.ts`
- `apps/gateway/src/tools/grep-files.ts`
- `apps/gateway/src/tools/grep-files.test.ts`
- `apps/gateway/src/tools/write-file.ts`
- `apps/gateway/src/tools/write-file.test.ts`
- `apps/gateway/src/tools/write-file-proposal.ts`
- `apps/gateway/src/tools/mcp-list.ts`
- `apps/gateway/src/tools/mcp-list.test.ts`
- `apps/gateway/src/utils/find-rg.ts`

Optimization targets:

- separate tool implementation logic from route and orchestration concerns
- make builtin tools follow consistent input validation, error shaping, and result conventions
- reduce repeated filesystem and command-helper logic where a shared builtin-tools owner can keep it explicit

Stage constraints:

- do not move policy semantics back into tool implementations
- do not treat shell execution as the answer for repeated structured repo actions
- keep tool behavior stable while cleaning boundaries

Required validation:

- `pnpm --filter @cwmb/gateway lint`
- `pnpm --filter @cwmb/gateway test`
- `pnpm --filter @cwmb/gateway build`
- targeted regression coverage for every builtin tool moved in the slice
- root `pnpm lint`, `pnpm test`, and `pnpm build`

Definition of done:

- builtin tool implementations live behind one owner boundary
- route, registry, and policy layers no longer carry builtin-only execution details
- the builtin layer is cleaner without changing the current live tool behavior unexpectedly

Completed on April 28, 2026:

- `apps/gateway/src/builtin-tools/*` now owns the structured builtin implementations for `read_file`, `list_directory`, `search_files`, `grep_files`, `write_file`, `write_file_proposal`, and `mcp_list`, plus shared workspace-policy, workspace-search, binary-content, and `rg` helper seams.
- `apps/gateway/src/tool-registry/registry.ts` now consumes one builtin-tools owner seam instead of assembling staged builtin implementations inline, while `run_pwsh` remains outside that owner boundary for the later `shell-runtime` stage.
- `apps/gateway/src/tools/*` builtin files and `apps/gateway/src/utils/find-rg.ts` are now compat re-export seams rather than hidden owner locations for builtin execution logic.
- direct gateway tests now cover every moved builtin tool, including newly added direct coverage for `list_directory` and the still-disabled `write_file_proposal` placeholder.
- `pnpm --filter @cwmb/gateway lint`, `pnpm --filter @cwmb/gateway test`, `pnpm --filter @cwmb/gateway build`, and root `pnpm lint`, `pnpm test`, `pnpm build` succeeded again after the owner shift.
- no new live browser validation was required to close this stage because the shipped `/tools` and `/call-tool` behavior stayed compat-stable; the change was ownership and gateway-local testability.

## Stage 15: Execute Module Stage - Shell Runtime

Status: completed

Goal:

- make `apps/gateway/src/shell-runtime/*` the single owner for shell detection, command guarding, `cwd` and environment shaping, timeout control, and captured shell outputs

Target owner surfaces:

- `apps/gateway/src/shell-runtime/*`

Expected current source and compat surfaces:

- `apps/gateway/src/shell/detect-shell.ts`
- `apps/gateway/src/tools/run-pwsh.ts`
- `apps/gateway/src/config.ts`
- `apps/gateway/src/config.test.ts`
- future shell-related builtin surfaces as needed

Optimization targets:

- isolate shell-specific timing and process rules from tool policy and builtin orchestration
- keep shell behavior explicit enough to test before broader shell capability expansion
- make command guarding, timeout semantics, and captured output shaping easier to reason about

Stage constraints:

- do not reopen product-scope debate about whether shell is the mainline capability model
- do not let shell runtime own allow or deny decisions that belong to policy
- do not claim stage completion without direct shell-runtime tests; current coverage is too indirect for that

Required validation:

- `pnpm --filter @cwmb/gateway lint`
- `pnpm --filter @cwmb/gateway test`
- `pnpm --filter @cwmb/gateway build`
- targeted shell-runtime tests for shell detection, guard behavior, timeout shaping, and captured output contracts
- root `pnpm lint`, `pnpm test`, and `pnpm build`

Definition of done:

- shell process semantics have one gateway owner
- shell behavior is testable directly instead of only through higher-level tool paths
- shell remains a guarded power-tool plane rather than a policy or registry substitute

Completed on April 28, 2026:

- `apps/gateway/src/shell-runtime/*` now owns shell detection, configured-shell normalization, `run_pwsh` command guarding, workspace-relative `cwd` shaping, environment shaping, timeout handling, and captured output contracts.
- `apps/gateway/src/shell/detect-shell.ts` and `apps/gateway/src/tools/run-pwsh.ts` now act only as compat re-export seams, while direct gateway consumers route to the new shell-runtime owner.
- `apps/gateway/src/config.ts` and `apps/gateway/src/config.test.ts` now normalize and verify supported shell selection through the shell-runtime owner boundary instead of leaving shell choice as an unverified config string.
- direct shell-runtime tests now cover shell detection fallback, guard behavior, timeout shaping, and captured stdout/stderr/combined-output contracts.
- `run_pwsh` remains a guarded power-tool plane: registry exposure still depends on `allowPwsh`, and shell-runtime still does not own higher-level allow or deny policy decisions.
- `pnpm --filter @cwmb/gateway lint`, `pnpm --filter @cwmb/gateway test`, `pnpm --filter @cwmb/gateway build`, and root `pnpm lint`, `pnpm test`, `pnpm build` succeeded again after the owner shift.
- no new live browser validation was required to close this stage because the change stayed inside gateway-local shell ownership and did not alter browser runtime timing or DOM behavior.

## Stage 16: Execute Module Stage - Audit Log

Status: completed

Goal:

- move execution, policy, and lifecycle audit ownership into `apps/gateway/src/audit-log/*`

Target owner surfaces:

- `apps/gateway/src/audit-log/*`

Expected current source and compat surfaces:

- `apps/gateway/src/logger.ts`
- `apps/gateway/src/routes/call-tool.ts`
- `apps/gateway/src/routes/call-tool.test.ts`
- `apps/gateway/src/execution-kernel/*` once that stage is complete
- `docs/operations/security.md`

Optimization targets:

- make audit events describe stable execution, policy, and lifecycle concepts instead of route-local strings
- keep redaction and truthfulness explicit before diagnostics starts aggregating audit data
- reduce scattered logging side effects across gateway files

Stage constraints:

- do not turn audit log into a formatting layer for panel UX
- do not merge diagnostics aggregation into the audit owner
- do not log unredacted secrets or unstable internal-only fragments as durable audit truth

Required validation:

- `pnpm --filter @cwmb/gateway lint`
- `pnpm --filter @cwmb/gateway test`
- `pnpm --filter @cwmb/gateway build`
- targeted audit-log tests for event shaping, redaction, and kernel integration
- root `pnpm lint`, `pnpm test`, and `pnpm build`

Definition of done:

- audit events have one gateway owner
- event shapes are explicit enough for later diagnostics to consume without reverse-engineering route behavior
- logging truth is more structured and more stable than before the stage

Completed on April 28, 2026:

- `apps/gateway/src/audit-log/*` now owns structured execution, policy, and lifecycle audit event types, durable event shaping, redacted argument/result summaries, and JSONL persistence.
- `apps/gateway/src/logger.ts` now acts only as a compat re-export seam, while direct gateway ownership moved behind `apps/gateway/src/audit-log/index.ts`.
- `apps/gateway/src/execution-kernel/execution-kernel.ts` now emits audit owner events instead of assembling route-local log payloads inline, and each execution now records a request-level lifecycle summary in addition to per-call policy or execution events.
- direct audit-log tests now cover event shaping, result and argument redaction, and request-level lifecycle summaries, while kernel tests verify the live gateway path emits the new owner events in-place.
- `docs/operations/security.md` and `docs/operations/gateway.md` now treat durable audit truth as redacted execution, policy, and lifecycle concepts rather than raw route-local fragments or panel-facing formatting.
- `pnpm --filter @cwmb/gateway lint`, `pnpm --filter @cwmb/gateway test`, `pnpm --filter @cwmb/gateway build`, and root `pnpm lint`, `pnpm test`, `pnpm build` succeeded again after the owner shift.
- no new live browser validation was required to close this stage because the change stayed inside gateway-local audit ownership and did not alter browser runtime timing, DOM behavior, or the live `/health` floor.

## Stage 17: Execute Module Stage - Diagnostics

Status: completed

Goal:

- move diagnostics ownership into `apps/gateway/src/diagnostics/*` and keep it read-only relative to execution control

Target owner surfaces:

- `apps/gateway/src/diagnostics/*`

Expected current source and compat surfaces:

- `apps/gateway/src/routes/health.ts`
- `apps/gateway/src/routes/health.test.ts`
- `apps/gateway/src/config.ts`
- `apps/gateway/src/logger.ts`
- `apps/gateway/src/audit-log/*` once that stage is complete
- `docs/operations/gateway.md`
- `docs/operations/security.md`

Optimization targets:

- aggregate gateway health, config-derived runtime facts, audit summaries, and redacted diagnostics bundles without creating a second control plane
- keep diagnostics aligned with the actual owners for execution, registry, policy, and audit data
- improve operator and developer troubleshooting value while preserving redaction boundaries

Stage constraints:

- diagnostics must observe, not control
- do not bypass redaction rules for convenience
- do not reintroduce execution orchestration through diagnostics endpoints or bundles

Required validation:

- `pnpm --filter @cwmb/gateway lint`
- `pnpm --filter @cwmb/gateway test`
- `pnpm --filter @cwmb/gateway build`
- targeted diagnostics tests for health shaping, redaction, and aggregated snapshot correctness
- matching userscript-side regression coverage if the stage changes live `/health` fields or health-derived runtime assumptions
- root `pnpm lint`, `pnpm test`, and `pnpm build`
- at least one browser-to-gateway validation pass if the stage changes the live `/health` floor

Definition of done:

- diagnostics has one read-only owner
- health and diagnostics outputs are grounded in stable upstream owners rather than route-local assembly
- redacted operator-facing troubleshooting truth is clearer without affecting execution behavior

Completed on April 28, 2026:

- `apps/gateway/src/diagnostics/*` now owns gateway health snapshot creation, config-derived runtime facts, and redacted diagnostics-bundle assembly instead of leaving `/health` shaping and troubleshooting truth spread across route-local code.
- `apps/gateway/src/routes/health.ts` now acts only as a thin compat adapter over the diagnostics owner seam, and the live `/health` response contract remains unchanged.
- `apps/gateway/src/audit-log/*` now exposes diagnostics-friendly read-only summary primitives for entry aggregation, while `apps/gateway/src/logger.ts` remains a compat re-export seam rather than a second diagnostics owner.
- direct diagnostics tests now cover health shaping plus aggregated bundle correctness, and audit summary tests now cover diagnostics-facing redaction and aggregate counts.
- `pnpm --filter @cwmb/gateway lint`, targeted diagnostics tests, `pnpm --filter @cwmb/gateway test`, `pnpm --filter @cwmb/gateway build`, and root `pnpm lint`, `pnpm test`, `pnpm build` succeeded again after the owner shift.
- no userscript-side regression rerun or browser-to-gateway validation was required to close this stage because the change did not alter the live `/health` floor or any browser-runtime timing/DOM behavior.

## Stage 18: Execute Module Stage - Package Domain Extraction

Status: completed

Goal:

- split `packages/protocol/` into focused domain packages (`turn-model`, `tool-contracts`, `policy-model`, `result-model`), rename `packages/shared/` to `packages/shared-utils/`, create `packages/test-fixtures/`, and delete the old `protocol/` package

Target owner surfaces:

- `packages/turn-model/*` — TurnContext and MCP turn analysis types extracted from protocol
- `packages/tool-contracts/*` — ToolDescriptor, ExecuteRequest, ExecuteResponse extracted from protocol
- `packages/policy-model/*` — PolicyDecision, ToolAssessment extracted from protocol
- `packages/result-model/*` — ResultEnvelope, BatchResult, inline/error result shapes extracted from protocol
- `packages/shared-utils/*` — renamed from `packages/shared/`: errors, redaction, truncation, plus cross-domain shared types formerly in protocol (e.g. anything used by multiple domain packages)
- `packages/test-fixtures/*` — shared test data, factory helpers, mock builders for all domain types

Expected current source and compat surfaces:

- `packages/protocol/src/*` — all current protocol exports
- `packages/shared/src/*` — all current shared exports
- Every import of the legacy protocol package across `apps/extension/`, `apps/gateway/`, `apps/userscript/`, and other workspace packages

Optimization targets:

- give each domain concept (turn, tool contract, policy, result) its own package so boundaries are visible at the dependency level
- eliminate the catch-all "protocol" concept that mixes transport shapes with domain models
- make `shared-utils` a true utility layer rather than a second dumping ground
- create `test-fixtures` so downstream stages and future work can write tests against shared factory helpers instead of reconstructing test data per app

Stage constraints:

- do not change any runtime behavior, type semantics, or API contract shapes — this stage is purely structural (move types, rename packages, update imports)
- do not open extension or gateway module extraction while this stage is active
- do not add new types, fields, or capabilities beyond what is mechanically required to complete the split
- cross-domain shared types (used by 2+ domain packages) go into `shared-utils/`, not into one domain package that others must depend on
- `test-fixtures/` may import from all domain packages and `shared-utils/`, but no domain package may depend on `test-fixtures/`

Required validation:

- every new package builds independently (`pnpm --filter <pkg> build`)
- every new package has a minimal `index.ts` that re-exports its public surface
- all consumer imports across extension, gateway, and userscript are updated to point to the correct domain package
- `packages/protocol/` is deleted from the workspace and `pnpm-workspace.yaml`
- root `pnpm lint`, `pnpm test`, and `pnpm build` pass with zero legacy protocol-package references remaining

Definition of done:

- domain types live in exactly one obvious package rather than spread across a catch-all `protocol/`
- no file in the repo imports the legacy protocol package
- `packages/shared/` is renamed to `packages/shared-utils/` and its package.json name is `@cwmb/shared-utils`
- `packages/test-fixtures/` exists with at least factory helpers for the three most-used domain types
- every workspace package.json that previously depended on the legacy protocol package now depends only on the specific domain packages it actually uses
- root verification passes without compat workarounds

Completed on April 28, 2026:

- `packages/protocol/` has been deleted. Its exports now live in `packages/turn-model`, `packages/tool-contracts`, `packages/policy-model`, `packages/result-model`, and `packages/shared-utils`, with `packages/test-fixtures` added for shared factories.
- `packages/shared/` has been renamed to `packages/shared-utils/`, and all gateway/userscript/extension consumers now import from the focused domain packages instead of the legacy protocol package.
- `apps/userscript` now resolves the Stage 18 domain packages explicitly in both `tsconfig` path mappings and esbuild aliases, so extension-owned source pulled into the userscript bundle no longer depends on the removed package name.
- `pnpm --filter @cwmb/shared-utils build`, `@cwmb/turn-model build`, `@cwmb/policy-model build`, `@cwmb/result-model build`, `@cwmb/tool-contracts build`, `@cwmb/test-fixtures build`, `pnpm --filter @cwmb/userscript lint`, `test`, `build`, `pnpm --filter @cwmb/gateway lint`, `test`, `build`, and root `pnpm lint`, `pnpm test`, `pnpm build` all succeeded after the split.

## Stage 19: Execute Module Stage - Extension Structure

Status: completed

Current code-side status:

- April 28, 2026: the extension package, manifest v3 shell, background service worker, content-script entrypoint, main-world request hook, and `apps/extension/src/main/` composition root are now landed in code.
- April 28, 2026: the user confirmed the remaining extension-path issue had been fixed in the latest commit and approved closing Stage 19 so Stage 20 could begin.

Goal:

- complete the Chrome Extension shell so `apps/extension/` is a real, installable extension that fully owns the browser runtime — replacing the userscript as the primary browser app

Target owner surfaces:

- `apps/extension/src/extension-shell/` — Chrome Extension manifest v3, background service worker (lifecycle management, alive ping, runtime messaging hub), content script entrypoint (injection trigger, page-actor bootstrap)
- `apps/extension/src/main/` — composition root that wires `chatgpt-adapter`, `injection-runtime`, `turn-runtime`, `result-delivery`, and `operator-panel` into a single extension-runtime lifecycle (startup, injection, turn polling, execution, delivery, panel updates)

Expected current source and compat surfaces:

- `apps/userscript/src/chatgpt-mcp-bridge.user.ts` — current runtime orchestration that must be ported to extension-owned `main/`
- `apps/userscript/src/dom.ts`, `selectors.ts` — DOM interaction primitives that the extension content script must provide
- `apps/userscript/src/ui.ts` — operator panel rendering that must be adapted for extension shadow-DOM isolation
- `apps/extension/src/chatgpt-adapter/` — already the owner for page facts; extension shell will consume it directly
- `apps/extension/src/injection-runtime/` — already the owner for catalog injection; extension shell will install it via content script
- `apps/extension/src/turn-runtime/` — already the owner for turn analysis; extension shell will drive its polling lifecycle
- `apps/extension/src/result-delivery/` — already the owner for delivery semantics; extension shell will connect it to the page DOM
- `apps/extension/src/operator-panel/` — already the owner for panel state; extension shell will mount it in an isolated DOM context
- `docs/operations/chatgpt-web-runtime-evidence.md`

Optimization targets:

- replace the userscript's Greasemonkey-style injection lifecycle with a proper Chrome Extension service-worker + content-script model
- make the extension's startup, injection timing, turn polling, execution dispatch, and panel rendering explicit in one composition root (`main/`)
- preserve all current live runtime behavior (hidden injection, invalid-turn enforcement, startup/history rescan, execute/insert/send) while changing who owns the orchestration loop
- isolate DOM interaction behind the content script boundary so the rest of the extension does not depend on Greasemonkey APIs

Stage constraints:

- do not change turn-runtime, injection-runtime, result-delivery, or operator-panel owner semantics — this stage wires them, it does not reopen their internal logic
- do not open gateway-side work while this stage is active
- do not change the live runtime contracts (`/health`, `/tools`, `/call-tool`, hidden injection, turn enforcement, rescan, execute/insert/send semantics)
- the current userscript must remain buildable and functional until Stage 21 removes it — this stage adds the extension as a parallel runtime, not as an immediate replacement
- do not introduce new capabilities (proposal workflow, reviewed/yolo, external MCP) through the extension shell

Required validation:

- `pnpm --filter @cwmb/extension lint`, `test`, and `build` pass
- the extension loads in Chrome without manifest errors
- the background service worker starts and logs a lifecycle ping
- the content script injects into a target ChatGPT Web page and confirms DOM access
- the existing userscript still builds and passes its tests (compat path preserved until Stage 21)
- root `pnpm lint`, `pnpm test`, and `pnpm build` pass
- real ChatGPT Web validation: hidden injection, turn detection, execution, and result delivery all function through the extension path

Definition of done:

- `apps/extension/` has a valid `manifest.json` (v3), a background service worker, and a content script entrypoint
- `apps/extension/src/main/` is the single composition root that wires all extension-owned runtime modules
- the extension can be loaded unpacked in Chrome and confirms alive status on a ChatGPT Web page
- the current live runtime floor (injection, turn enforcement, rescan, execute/insert/send) is verified through the extension path on real ChatGPT Web
- userscript still builds and works as a fallback until Stage 21

## Stage 20: Execute Module Stage - Gateway Structure

Status: completed

Current code-side status:

- April 28, 2026: `apps/gateway/src/api/*`, `proposal-engine/*`, `external-mcp/*`, `result-cache/*`, and `main/*` are now landed in code, with `routes/*`, `server.ts`, and `index.ts` reduced to compatibility shells over the new owners.
- April 28, 2026: `pnpm --filter @cwmb/gateway lint`, `test`, and `build` all passed after the Stage 20 structure slice landed.
- April 28, 2026: root `pnpm lint`, `pnpm test`, and `pnpm build` also passed after the Stage 20 structure slice landed.
- April 28, 2026: the user confirmed manual browser-to-gateway validation for `/health`, `/tools`, and `/call-tool` through the new `api/` adapters, so Stage 20 can close.

Goal:

- complete the gateway module layout by creating `api/` (replacing `routes/`), `proposal-engine/`, `external-mcp/`, `result-cache/`, and `main/` — with new modules delivered as typed interfaces plus stub implementations

Target owner surfaces:

- `apps/gateway/src/api/` — HTTP adapter layer: health, tools, and call-tool route handlers as thin validation + delegation adapters over the proper gateway owners; replaces `apps/gateway/src/routes/`
- `apps/gateway/src/proposal-engine/` — typed interfaces for proposal lifecycle (Proposal, ProposalState, ProposalEngine), stub no-op implementation; this stage defines the contract, not the workflow rollout
- `apps/gateway/src/external-mcp/` — typed interfaces for external MCP connection management (McpEndpoint, ExternalMcpRegistry), stub no-op implementation; this stage defines the contract, not the integration rollout
- `apps/gateway/src/result-cache/` — typed interfaces for result caching (CacheKey, CacheEntry, ResultCache), stub in-memory implementation with TTL semantics; this stage defines the contract and a basic working cache
- `apps/gateway/src/main/` — gateway composition root that wires `api/`, `execution-kernel/`, `tool-registry/`, `tool-policy/`, `builtin-tools/`, `shell-runtime/`, `proposal-engine/`, `external-mcp/`, `result-cache/`, `audit-log/`, and `diagnostics/` into one server entrypoint; replaces the current `index.ts` / `server.ts` flat composition

Expected current source and compat surfaces:

- `apps/gateway/src/routes/*` — current route handlers to be replaced by `api/` adapters
- `apps/gateway/src/index.ts` — current flat entrypoint to be replaced by `main/`
- `apps/gateway/src/server.ts` — current server bootstrap to be consumed by `main/`
- `packages/tool-contracts/` — domain package for tool descriptor types used by `proposal-engine/` and `external-mcp/` interfaces
- `packages/policy-model/` — domain package for decision types used by `proposal-engine/` interfaces
- `packages/result-model/` — domain package for result envelope types used by `result-cache/` interfaces

Optimization targets:

- make every gateway concern visible as a named module directory rather than hidden inside flat route or entrypoint files
- give `proposal-engine/`, `external-mcp/`, and `result-cache/` stable typed interfaces so later phases can implement them without reopening module-boundary debates
- replace the `routes/` directory — which has been a compat adapter layer since Stages 11-17 — with a properly named `api/` layer that owns HTTP adaptation
- give the gateway a single composition root (`main/`) that makes dependency wiring explicit and testable

Stage constraints:

- `proposal-engine/` and `external-mcp/` must remain interface + stub only — this stage defines contracts, not capability rollout
- `result-cache/` may include a basic in-memory implementation (TTL, max-size cap) but must not introduce persistent storage, distributed cache semantics, or a second source of execution truth
- `api/` must delegate all execution, policy, registry, and diagnostics decisions to the proper owners — it is an HTTP adapter, not a second orchestration layer
- do not open browser-runtime work while this stage is active
- do not change the live runtime contracts (`/health`, `/tools`, `/call-tool`)
- the current `routes/` directory and flat `index.ts` / `server.ts` entrypoints remain until Stage 21 removes them

Required validation:

- `pnpm --filter @cwmb/gateway lint`, `test`, and `build` pass
- direct tests for `api/` adapters confirm they delegate to the correct owners
- direct tests for `main/` confirm it starts a server with all modules wired
- type-level tests for `proposal-engine/`, `external-mcp/`, and `result-cache/` confirm their interfaces are consumable
- existing gateway owner tests (execution-kernel, tool-registry, tool-policy, builtin-tools, shell-runtime, audit-log, diagnostics) continue to pass
- root `pnpm lint`, `pnpm test`, and `pnpm build` pass
- at least one browser-to-gateway validation pass for the live `/health`, `/tools`, and `/call-tool` paths through the new `api/` adapters

Definition of done:

- `apps/gateway/src/api/` owns the HTTP adapter layer and all three live routes delegate through it to their proper owners
- `apps/gateway/src/proposal-engine/` exports a typed `ProposalEngine` interface and a no-op stub
- `apps/gateway/src/external-mcp/` exports a typed `ExternalMcpRegistry` interface and a no-op stub
- `apps/gateway/src/result-cache/` exports a typed `ResultCache` interface and a working in-memory implementation
- `apps/gateway/src/main/` is the single composition root that wires all gateway modules
- the current `routes/`, `index.ts`, and `server.ts` remain as compat shells until Stage 21
- root verification passes and live gateway paths are confirmed stable

## Stage 21: Execute Module Stage - Remove All Compatibility Layers

Status: planned

Goal:

- delete every compat re-export, adapter shell, and legacy directory that exists only to preserve the old structure — and archive `apps/userscript/` as a legacy reference

Target owner surfaces:

- (this stage deletes surfaces, not creates them)

Expected current source and compat surfaces to be removed:

- `apps/gateway/src/routes/*` — compat route adapters, replaced by `api/` since Stage 20
- `apps/gateway/src/tools/*` — compat re-exports for builtin tools, all consumers now import from `builtin-tools/` directly
- `apps/gateway/src/security/*` — compat re-exports for tool policy, all consumers now import from `tool-policy/` directly
- `apps/gateway/src/shell/*` — compat re-exports for shell runtime, all consumers now import from `shell-runtime/` directly
- `apps/gateway/src/utils/*` — compat re-exports for shared utilities, all consumers now import from `shared-utils/` or the appropriate domain package
- `apps/userscript/*` — entire directory archived, removed from pnpm workspace
- `apps/userscript/src/parser.ts` — compat wrapper for turn analysis
- `apps/userscript/src/catalog.ts`, `catalog-cache.ts`, `request-injection-state.ts` — compat re-exports for injection-runtime
- `apps/userscript/src/runtime-snapshot.ts`, `capabilities.ts` — compat re-exports for operator-panel
- `apps/userscript/src/detection-state.ts`, `round-guard.ts`, `turn-runtime.ts` — compat consumers of turn-runtime
- `apps/userscript/src/inserter.ts`, `preview.ts` — compat consumers of result-delivery
- `apps/userscript/src/ui.ts` — compat panel render shell
- `apps/userscript/src/state.ts` — compat state holder
- `apps/userscript/src/chatgpt-mcp-bridge.user.ts` — former main userscript entrypoint
- `apps/userscript/src/dom.ts`, `selectors.ts` — DOM helpers now owned by extension content script
- Any remaining legacy protocol-package references (should be zero after Stage 18)

Optimization targets:

- the target directory structure becomes the only directory structure — no compat re-exports, no legacy shells, no "temporary" adapters
- gateway consumers import from exactly one obvious owner per concept
- browser runtime consumers live exclusively in `apps/extension/`
- `apps/userscript/` is archived with a README noting its legacy status, not kept as a buildable workspace member

Stage constraints:

- do not delete any file that still owns unique runtime behavior — if a compat file contains logic not yet migrated to the proper owner, stop and complete that migration first
- do not change any runtime behavior, type semantics, or API contract — this stage only removes indirection
- do not open new module extraction, capability work, or product-scope changes
- the live runtime floor remains authoritative throughout

Required validation:

- root `pnpm lint`, `pnpm test`, and `pnpm build` pass with zero references to deleted paths
- `pnpm-workspace.yaml` no longer lists `apps/userscript`
- root `package.json` scripts no longer reference userscript
- every import in the repo points to a proper long-term owner (no compat middlemen remain)
- `git grep` for removed package names (`packages/protocol`, `packages/shared`, `@cwmb/userscript`) returns zero stale-workspace references
- real ChatGPT Web validation confirms the extension-only browser runtime path is fully functional

Definition of done:

- `apps/gateway/src/routes/`, `tools/`, `security/`, `shell/`, and `utils/` directories no longer exist
- `apps/userscript/` is archived (removed from workspace, README notes legacy status)
- every gateway consumer imports from the module that owns the concept (`execution-kernel/`, `tool-registry/`, `tool-policy/`, `builtin-tools/`, `shell-runtime/`, `api/`, `audit-log/`, `diagnostics/`, `main/`)
- every browser-runtime consumer lives under `apps/extension/`
- the repo directory structure matches the v0.9 target architecture
- root verification passes and live ChatGPT Web validation confirms the extension-only path

## Risks

- The codebase now carries a dual browser-runtime shape: the extension-first mainline path is landed in code, while the userscript remains a required fallback until Stage 21 removes it. Stage 19 is now dialogue-closed, but repo-local real-page evidence is still stronger for the userscript path than for the extension path.
- Hidden request-layer injection, invalid-turn enforcement, result delivery, and operator recovery are still real-page behaviors; browser-only regressions cannot be dismissed by passing unit tests alone.
- Stage 20 now creates `gateway/api/`, `gateway/proposal-engine/`, `gateway/external-mcp/`, `gateway/result-cache/`, and `gateway/main/`, and the live browser-to-gateway path has now been manually validated before close-out.
- Follow-on work can still sprawl if a new slice is opened without first declaring its owner boundary and supporting seams in the task-control docs.
- The repo still lacks browser-driven end-to-end automation, so major browser-runtime transitions will continue to depend on real ChatGPT Web manual verification.
- Stage 18 (package-domain-extraction) is a high-risk atomic operation: splitting `protocol/` into 4 domain packages + renaming `shared/` + creating `test-fixtures` + updating every consumer import must succeed in one stage or the build breaks. The only valid intermediate state is "all imports updated and build passing."
- Stage 19 (extension-structure) introduces a new browser-runtime entrypoint (Chrome Extension) while the existing userscript runtime must remain functional. Dual-runtime validation adds overhead until Stage 21 removes the userscript.
- Stage 21 (remove-compat-layers) is the highest-risk deletion stage: if any compat file still carries unique runtime logic, deleting it will cause live-path regressions. Exhaustive pre-deletion verification is required.
