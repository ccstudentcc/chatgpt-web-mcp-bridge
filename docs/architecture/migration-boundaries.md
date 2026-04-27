# Migration Boundaries

## 0. Document Status

- Status: draft v1
- Purpose: define how the repository may move from the current implementation to the v0.9 target architecture
- Audience: maintainers and agents executing refactors
- Scope: migration ordering, compat rules, deletion gates, and stop conditions

This document complements [v0.9-target-architecture.md](./v0.9-target-architecture.md). The target architecture defines what the system should become. This document defines how refactor work is allowed to approach that target without growing a second architecture.

The old v0.1 real-page acceptance gate is already closed. Use current task-control docs to decide which v0.9 migration phase is actually active; do not treat this document as blanket authorization to start every later phase at once.

This migration guide follows the active v0.9 execution model defined in [v0.9-target-architecture.md](./v0.9-target-architecture.md) and [../prd_vnext.md](../prd_vnext.md). If a migration phase changes product-boundary assumptions, update both docs in the same pass instead of letting migration prose drift away from the active v0.9 truth.

## 1. Current Reality

### 1.1 Repository Shape Today

Current top-level implementation shape:

- `apps/userscript`
- `apps/gateway`
- `packages/protocol`
- `packages/shared`

Important current facts:

- Most real ChatGPT runtime knowledge still lives inside `apps/userscript/src/*`
- Gateway is still structurally flat relative to the target execution-kernel split
- Shared protocol and model layers are present, but too thin to carry the full target contract surface
- The strongest currently verified behavior knowledge comes from real userscript runtime behavior, not from a future gateway abstraction

### 1.2 What Must Not Be Misread

The current implementation layout is not the target ownership map.

In particular:

- `apps/userscript` is the current implementation container, not the final product shell
- `apps/gateway/src/server.ts` and `index.ts` are current composition roots, not proof that the flat gateway shape is desirable
- `packages/shared` is a current utility bucket, not the intended final shared-model design

## 2. Target Reality

The target direction is:

- `apps/extension` as the final browser app
- `apps/gateway` as a structured execution kernel
- dedicated shared packages for contracts and stable models
- `apps/userscript` as a reference baseline only, not as a target shell that must survive the migration as a formal app layer

The migration path must not assume that target directories already exist in mature form. Refactors must create them by extracting responsibilities out of current locations.

## 3. Migration Principles

### 3.1 Freeze Contracts Before Large Moves

Shared contract and model work must lead structural extraction. Large file moves without contract stabilization are not allowed.

### 3.2 One Primary Axis Per Round

Each non-trivial refactor round must choose exactly one primary axis:

- boundary extraction
- behavior stabilization
- capability addition

Mixing large structural extraction and major capability expansion in the same round is forbidden.

### 3.3 One Ring Per Round

Each refactor round must have exactly one primary battleground ring:

- Final Core
- Extension Ring
- Compat Ring

The non-primary rings may only receive passive compatibility work.

### 3.4 Compat Only Gets Thinner

Compat code may adapt old entrypoints to target contracts. It may not become the first landing zone for new behavior.

If a new behavior can only be added in compat first, the refactor should stop and revisit ordering.

Userscript-specific compatibility is especially suspect here: the repo should not create or preserve a large `userscript-compat` destination just to mimic the old structure once a direct extension + gateway implementation path is available.

### 3.5 Real Runtime Truth Has Priority

Where current code, future architecture ideas, and real ChatGPT runtime behavior conflict, the migration must first restore accurate current truth before expanding target abstractions.

### 3.6 Current Canonical Contracts Stay Canonical Until Replaced

Current live contracts such as `/tools` must remain canonical until product truth docs and task-control docs explicitly approve a dual-route migration or a replacement contract. Migration work must not silently demote a currently live contract just because a target-state abstraction would prefer a different name.

## 4. Current-To-Target Mapping

### 4.1 Userscript Runtime Mapping

Current live entrypoints and remaining logic surfaces:

- `apps/userscript/src/catalog*.ts`
- `apps/userscript/src/request-hook.ts`
- `apps/userscript/src/parser.ts` as a partial compat wrapper around seeded extension turn-runtime owners
- `apps/userscript/src/detection-state.ts` as a compat consumer of seeded extension turn-runtime state helpers
- `apps/userscript/src/round-guard.ts` as a compat consumer of seeded extension turn-runtime guard helpers
- `apps/userscript/src/turn-runtime.ts` as a compat re-export entrypoint for seeded extension turn-runtime helpers
- `apps/userscript/src/inserter.ts`
- `apps/userscript/src/dom.ts`
- `apps/userscript/src/chatgpt-runtime-facts.ts` as a compat re-export of the seeded v0.9 adapter owner
- `apps/userscript/src/selectors.ts` as a legacy compat entrypoint only
- `apps/userscript/src/ui.ts`
- `apps/userscript/src/state.ts`

Already-seeded target owners that should win when the same semantics are touched:

- page facts and selectors -> `apps/extension/src/chatgpt-adapter/`
- request-injection mode and status helpers -> `apps/extension/src/injection-runtime/`
- runtime snapshot helpers -> `apps/extension/src/operator-panel/`
- MCP turn analysis, pending-turn detection, invalid-turn state, and round-guard helpers -> `apps/extension/src/turn-runtime/`

Target ownership mapping:

- catalog bootstrap and injection -> `apps/extension/src/injection-runtime/`
- turn parsing, invalid-turn handling, duplicate guard, rescan -> `apps/extension/src/turn-runtime/`
- DOM facts and selectors -> `apps/extension/src/chatgpt-adapter/`
- insertion and send handling -> `apps/extension/src/result-delivery/`
- panel rendering -> `apps/extension/src/operator-panel/`
- the current userscript shell -> reference baseline only; extract behavior into `apps/extension` / `apps/gateway` directly rather than planning a durable shell migration target

### 4.2 Gateway Mapping

Current source of truth:

- `apps/gateway/src/index.ts`
- `apps/gateway/src/server.ts`
- `apps/gateway/src/config.ts`
- `apps/gateway/src/logger.ts`

Target ownership mapping:

- HTTP route handling -> `apps/gateway/src/api/`
- execution orchestration -> `apps/gateway/src/execution-kernel/`
- catalog materialization -> `apps/gateway/src/tool-registry/`
- decision making -> `apps/gateway/src/tool-policy/`
- tool implementations -> `apps/gateway/src/builtin-tools/`
- shell handling -> `apps/gateway/src/shell-runtime/`
- audit and diagnostics -> `apps/gateway/src/audit-log/` and `apps/gateway/src/diagnostics/`
- current `server.ts` and `index.ts` -> temporary composition roots only

### 4.3 Shared Package Mapping

Current source of truth:

- `packages/protocol`
- `packages/shared`

Target ownership mapping:

- extension/gateway transport contracts -> `packages/protocol`
- turn normalization model -> `packages/turn-model`
- policy-facing model -> `packages/policy-model`
- result envelopes -> `packages/result-model`
- low-level helpers only -> `packages/shared-utils`

## 5. Module Maturity Matrix

| Module | Current reality | Target role | Current risk | Move priority |
|---|---|---|---|---|
| `chatgpt-adapter` | implicit and scattered in userscript | explicit extension module | DOM/runtime coupling | high |
| `injection-runtime` | partial and mixed with catalog logic | explicit extension module | mixed concerns | high |
| `turn-runtime` | real logic exists today | explicit extension module | likely to become a new god object | high |
| `result-delivery` | partial and mixed with DOM/UI concerns | explicit extension module | insertion/runtime entanglement | high |
| `execution-kernel` | mostly absent as a named layer | unique gateway orchestrator | high risk of overgrowth | high |
| `tool-registry` | mostly absent as a named layer | catalog truth owner | easily mixed with policy | high |
| `tool-policy` | only partial semantics exist today | explicit decision layer | rules can stay scattered | high |
| `proposal-engine` | future-facing | extension ring capability | can distract from core | medium |
| `external-mcp` | future-facing | extension ring capability | can overtake builtin focus | medium |

## 6. Ordered Migration Phases

### Phase 1: Freeze Shared Contracts

Primary battleground ring: Final Core

Goals:

- make `ExecutionContract`, `PolicyDecision`, `ResultEnvelope`, `TurnContext`, and `CatalogContract` single-source definitions
- grow shared packages before large app extraction

Vocabulary mapping for Phase 1:

- `ExecutionContract` includes `ExecuteRequest` and `ExecuteResponse`
- `PolicyDecision` includes per-call `ToolDecision`

Allowed work:

- shared types
- schemas
- contract tests
- narrow compatibility shims
- seeding a target-owner module such as `apps/extension/src/chatgpt-adapter/` when it removes duplicated ChatGPT Web page facts from current userscript code without starting a broad extraction

Forbidden work:

- broad UI redesign
- large builtin expansion
- proposal workflow build-out
- external MCP expansion
- renaming or demoting current live contracts such as `/tools` without an approved migration plan

Exit criteria:

- extension and gateway consume the same core contract types
- duplicated local shape definitions for core execution concepts are reduced or marked for removal

### Phase 2: Execute Final Core As One-Module Stages

Primary battleground ring: Final Core

Canonical sequencing rule:

- Phase 2 is not one large extension phase followed by one large gateway phase.
- Phase 2 is the one-module-at-a-time program defined in the root task-control docs.
- Exact module order, active stage, validation gates, and definition of done live in `SPEC.md`, `IMPLEMENTATION_PLAN.md`, and `TASK_STATUS.md`.

Current Phase 2 module order:

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

Goals:

- create target extension and gateway ownership boundaries one module at a time
- stop both browser and gateway runtime code from behaving like flat mixed-control surfaces
- preserve the current live runtime floor while improving timing clarity, failure isolation, and direct testability inside the active module stage

Allowed work:

- execute only the currently active module stage plus narrow supporting seams
- rewrite or reorganize behavior directly in `apps/extension` and `apps/gateway` when that shortens the path or clarifies ownership
- preserve current behavior while moving logic
- improve timing clarity, failure isolation, and direct testability inside the active module stage
- use narrow supporting seams only when they are required to finish the active module cleanly

Forbidden work:

- opening multiple primary module stages at once
- treating all browser-runtime modules as one batch
- treating gateway execution-kernel work as a later non-Phase-2 program
- major product-scope expansion or new capability families
- panel feature expansion unrelated to extraction
- preserving userscript structure just for migration symmetry when a cleaner extension plus gateway path is available

Exit criteria for each active Phase 2 stage:

- the active stage's owner semantics are directly tested instead of only through the monolith or route shell
- the stage does not reopen neighboring module stages implicitly
- the proven live runtime baseline is not weakened by the ownership shift
- matching consumer-side validation is rerun when the stage touches a still-live compatibility-floor route or browser-runtime path

### Phase 3: Introduce Mode-Aware Execution

Primary battleground ring: Final Core

Goals:

- make `reviewed` and `yolo` explicit and testable
- anchor mode semantics to the right owners

Prerequisite:

- root task-control docs must explicitly sequence mode rollout as an active v0.9 slice before it becomes implementation work

Allowed work:

- conversation execution profile support
- workspace hard policy integration
- explicit policy outputs

Forbidden work:

- using mode work as an excuse for broad capability expansion

Exit criteria:

- mode semantics live in policy, not spread across tool implementations
- both modes have clear tests and operator-facing semantics

### Phase 4: Expand Core Builtin Capabilities

Primary battleground ring: Final Core

Goals:

- lift high-frequency workflow actions into builtin tools
- keep `run_pwsh` as a power tool, not the whole tool surface

Allowed work:

- core builtin tools
- `run_task`
- `run_pwsh`
- result cache handoff for large outputs

Forbidden work:

- treating shell as the only answer for repeated structured tasks

Exit criteria:

- the core builtin set is materially stronger than the current read-only bridge
- shell execution has guardrails, audit context, and large-output handling

### Phase 5: Mature Extension Ring

Primary battleground ring: Extension Ring

Goals:

- complete proposal workflow
- add external MCP as a pluggable extension ring
- mature result cache UX and extended tools

Allowed work:

- proposal engine expansion
- external MCP lifecycle and proxying
- extended builtin families

Forbidden work:

- redefining Final Core boundaries to serve extension-ring convenience

Exit criteria:

- extension-ring capabilities consume the same core contracts and policy system
- no second execution architecture appears

## 7. Core Builtin vs Extended Builtin

### 7.1 Core Builtin

Core builtin tools should converge first:

- `read_file`
- `read_files`
- `list_directory`
- `search_files`
- `grep_files`
- `write_file`
- `patch_file`
- `git_status`
- `git_diff`
- `run_task`
- `run_pwsh`
- `mcp_list`

### 7.2 Extended Builtin

Extended builtin work belongs to the extension ring:

- `move_path`
- `copy_path`
- `delete_path`
- `create_directory`
- `create_file`
- `git_add`
- `git_commit`
- `git_restore_path`
- process lifecycle tools

Agents must not use extended builtin work to justify delaying Final Core extraction.

## 8. Compat Definition

Compat means:

> code that only adapts old entrypoints to target runtime contracts and never owns new behavior

Compat may:

- translate old route names to new contract semantics
- host temporary shell entrypoints
- bridge old runtime bootstrap paths

Compat may not:

- become the first home of new behavior
- carry exclusive runtime logic after target modules exist
- own a second state machine
- redefine long-term contracts locally
- demote a currently canonical live route such as `/tools` unless an approved migration plan exists

## 9. Deletion Conditions

### 9.1 Deleting The Old Userscript Main Implementation

The old userscript-centric primary implementation may only be removed once all of the following are true:

- `apps/extension` is the primary browser app
- hidden injection works there
- invalid-turn handling works there
- startup rescan and duplicate guard work there
- result insertion and auto-send work there
- userscript no longer owns exclusive runtime behavior
- manual acceptance has been updated to the extension-first flow

### 9.2 Deleting Flat Gateway Entry Logic

The old flat gateway execution shape may only be removed once:

- `execution-kernel` is the unique execution entrypoint
- `tool-policy` is explicit
- `tool-registry` owns materialized catalog generation
- route handlers no longer call tool implementations directly

### 9.3 Deleting Temporary Shared Shapes

Temporary local type copies or shape adapters may only be removed once:

- core execution shapes are defined in shared packages
- extension and gateway both consume them directly
- duplicated local approximations are no longer needed

### 9.4 Deleting Compat Routes

A compat route may only be removed once:

- the new logical contract is stable
- documentation reflects the newer contract
- the primary runtime path no longer depends on the old route name
- automated and manual verification no longer rely on the compat route

## 10. Stop Conditions

Refactor work must stop when any of the following become true:

- protocol semantics are still unclear
- a single change crosses too many layers to verify safely
- current behavior truth is inconsistent across docs, code, and runtime
- compat would need to grow a second execution path
- verification cannot justify the claimed change

Stopping is the correct outcome in those cases. Continuing anyway is architectural drift.

## 11. Related Documents

- [v0.9-target-architecture.md](./v0.9-target-architecture.md)
- [docs/prd.md](../prd.md)
- [docs/prd_vnext.md](../prd_vnext.md)
- [extension-runtime.md](./extension-runtime.md)
- [gateway-kernel.md](./gateway-kernel.md)
