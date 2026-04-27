# Current Scope Spec

Current boundary: as of April 27, 2026, the v0.1 real-page stop line is closed. This file now tracks the active v0.9 mainline scope. `docs/prd.md` remains the closed v0.1 reference baseline; [docs/v0.9-entrypoint.md](docs/v0.9-entrypoint.md) and [docs/prd_vnext.md](docs/prd_vnext.md) are the active target-state entry docs.

## Goal

Turn the proven v0.1 userscript + gateway baseline into the real v0.9 product target: ChatGPT Web Local Agent Bridge, while keeping the current live runtime contracts explicit until each one is intentionally migrated or replaced.

## Current Slice

Phase 1 shared-contract freeze is complete. The active next slice is Phase 2 turn-runtime extraction.

This slice exists so the repo can make a larger structural move without reopening multiple axes at once.

Primary battleground:

- Final Core

Primary axis:

- extension runtime boundary extraction

Current goal:

- move parser-level turn normalization and nearby turn-runtime seams behind the extension `turn-runtime` owner while preserving the proven live browser behavior

Primary file surfaces:

- `apps/extension/src/turn-runtime/*`
- `apps/userscript/src/parser.ts`
- `apps/userscript/src/chatgpt-mcp-bridge.user.ts`
- `apps/userscript/src/detection-state.ts`
- `apps/userscript/src/round-guard.ts`
- current userscript tests that exercise turn parsing, invalid-turn handling, duplicate guard, and startup/history rescan
- `docs/operations/chatgpt-web-runtime-evidence.md`
- the root task-control docs

## Slice Intent

Create one explicit extension-owned turn-runtime boundary so the browser-side runtime stops behaving like a single giant userscript before gateway-kernel extraction or capability rollout begins.

At minimum, this slice should make it possible to implement against a stable target for:

- assistant turn normalization
- invalid-turn classification
- duplicate guard seams
- latest-open-turn tracking and startup/history rescan
- `ExecuteRequest` creation inputs owned by browser runtime turn truth

## In Scope

- Keep the current live runtime behavior documented in `docs/prd.md` as the migration floor rather than the active product target.
- Preserve current live contracts during this extraction slice unless a migration path is explicitly documented:
  - `/health`
  - `/tools`
  - `/call-tool`
  - hidden request-layer injection
  - invalid-turn enforcement
  - startup/history rescan
  - execute / insert / send runtime semantics
- Update root task-control docs whenever the active v0.9 slice, gate, or sequencing truth changes.
- Treat draft v0.9 docs and draft contract surfaces as reference/target truth, not as compatibility obligations by themselves. Compatibility effort in this slice belongs to the current live runtime floor, not to preserving interim draft wording.
- Continue converging browser-side turn-runtime ownership into `apps/extension/src/turn-runtime/*`.
- Move parser-level turn analysis and normalization logic out of long-term userscript ownership and behind extension-owned seams.
- Keep userscript-side consumption on thin compatibility wiring where extraction is not yet complete.
- Allow a larger same-axis package across parser/analyze, latest-open-turn detection, startup/history rescan, duplicate guard, and nearby turn-runtime orchestration, as long as it stays inside this one extraction axis.
- Keep `docs/operations/chatgpt-web-runtime-evidence.md` as the only allowed repository source for ChatGPT Web DOM/request-shape/selectors evidence.

## Out of Scope

- Reopening v0.1 as the active product target.
- Pretending v0.9 is already shipped because the target docs are mature.
- Breaking the current userscript + gateway baseline without an explicit migration and re-verification plan.
- Opening more than one primary axis in the same round.
- Broad capability rollout such as:
  - full proposal workflow
  - `reviewed` / `yolo` execution rollout
  - `run_pwsh` shipping
  - external/custom MCP rollout
  - extension-first shell migration
- Major gateway execution-kernel extraction.
- Full `result-delivery` extraction beyond the narrow seams needed to preserve the current turn-runtime path.
- Operator-panel feature expansion unrelated to extraction.
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
- This slice must keep one primary battleground ring and one primary axis:
  - ring: Final Core
  - axis: extension `turn-runtime` extraction
- The current compatibility floor must remain stable during this slice:
  - `/health`
  - `/tools`
  - `/call-tool`
  - hidden request-layer injection
  - invalid-turn enforcement
  - startup/history rescan
  - execute / insert / send runtime semantics
- ChatGPT Web DOM/request-shape facts must be recorded in `docs/operations/chatgpt-web-runtime-evidence.md` rather than duplicated across multiple docs.
- Parser-level turn normalization must converge into `apps/extension/src/turn-runtime/*` rather than remaining a long-term truth source inside `apps/userscript/src/parser.ts`.
- Verification must remain reproducible from the repo root whenever code changes are made.

## Acceptance Criteria

- Root task-control docs consistently state that v0.1 closed on April 27, 2026 and now serves as a reference baseline only.
- `docs/v0.9-entrypoint.md`, `docs/prd_vnext.md`, and the root task docs all agree that v0.9 is the active mainline.
- The active Phase 2 slice is explicit enough that implementation can begin without reopening which subsystem or battleground comes next.
- `IMPLEMENTATION_PLAN.md` contains concrete stage goals, battleground, and file surfaces for the current slice.
- The current runtime contracts that must survive early migration work are clearly enumerated in repo docs.
- No active task-control or v0.9 entry doc still says that v0.1 close-out is blocking v0.9 by default.
- The active slice clearly limits itself to one larger `turn-runtime` extraction package instead of broad new capabilities or parallel extraction axes.
- The repo has one explicit source of truth for ChatGPT Web DOM/request-shape evidence, and the task docs point to it instead of duplicating its content.
- The repo has one explicit v0.9 owner for parser-level turn normalization and nearby turn-runtime semantics, and userscript modules are treated as compat consumers rather than the long-term source of truth.
- Phase 2 close-out requires both repo-root verification and at least one real ChatGPT Web validation pass because the slice changes browser-runtime ownership boundaries.
