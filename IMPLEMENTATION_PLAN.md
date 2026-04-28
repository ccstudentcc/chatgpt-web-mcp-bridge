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

Why this order:

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

Resequencing rule:

- resequence only when the active module reveals a hard dependency that would materially improve stability or validation order
- any resequencing must update `SPEC.md`, `IMPLEMENTATION_PLAN.md`, and `TASK_STATUS.md` together before code work proceeds

## Phase 2 Stage Execution Rules

These rules apply to every Stage 7 through Stage 17 slice:

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

Status: in progress

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
- remaining gate for this stage is real ChatGPT Web validation of first-send hidden injection, cached-bootstrap warmup, visible fallback behavior, and request-hook diagnostics timing

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

Status: pending

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

## Stage 11: Execute Module Stage - Execution Kernel

Status: pending

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

## Stage 12: Execute Module Stage - Tool Registry

Status: pending

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

## Stage 13: Execute Module Stage - Tool Policy

Status: pending

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

## Stage 14: Execute Module Stage - Builtin Tools

Status: pending

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

## Stage 15: Execute Module Stage - Shell Runtime

Status: pending

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

## Stage 16: Execute Module Stage - Audit Log

Status: pending

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

## Stage 17: Execute Module Stage - Diagnostics

Status: pending

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

## Risks

- The codebase still implements the proven userscript-first runtime, so the target docs remain ahead of the structure.
- Hidden request-layer injection, invalid-turn enforcement, result delivery, and operator recovery are still real-page behaviors; browser-only regressions cannot be dismissed by passing unit tests alone.
- Several Phase 2 target modules do not yet exist as concrete directories, so later stages must create direct owner tests instead of relying only on route or monolith regressions.
- Phase 2 can still sprawl if multiple module stages are opened at once or if supporting seams are allowed to become hidden long-term owners.
- The repo still lacks browser-driven end-to-end automation, so major browser-runtime transitions will continue to depend on real ChatGPT Web manual verification.
