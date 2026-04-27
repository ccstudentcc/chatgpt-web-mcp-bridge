# Task Status

## Current Truth

- On April 27, 2026, the user confirmed that the real signed-in ChatGPT Web flow is usable and formally closed the v0.1 stop line.
- `docs/prd.md` is now the closed v0.1 reference baseline: a useful behavior reference for the proven userscript + gateway runtime, but no longer the active product target.
- Root `SPEC.md`, `IMPLEMENTATION_PLAN.md`, and `TASK_STATUS.md` now track the active v0.9 mainline.
- `docs/v0.9-entrypoint.md` is the navigation entrypoint for that mainline; `docs/prd_vnext.md` owns the active product-boundary truth; `docs/architecture/v0.9-target-architecture.md` owns the target module-boundary truth.
- The current codebase still implements the proven userscript + gateway baseline, so v0.9 work must preserve or explicitly migrate the current live contracts rather than pretending they no longer matter.
- The current active v0.9 slice is Phase 1 shared-contract freeze, not broad feature rollout and not extension migration.
- Stage 3 slice-definition work is complete; Stage 4 compat-preserving execution is now in progress on the same Phase 1 boundary.
- Draft v0.9 docs and draft contract shapes are reference truth only. They are not separate compatibility targets; compatibility work in the current slice applies to the proven live runtime floor and the still-live routes/behaviors it depends on.
- ChatGPT Web DOM/request-shape/selectors evidence now has one intended home: `docs/operations/chatgpt-web-runtime-evidence.md`.
- ChatGPT Web page-fact code truth now targets one v0.9 owner: `apps/extension/src/chatgpt-adapter/`; current userscript code should only consume or compat-re-export that truth.
- Phase 1 implementation has started in code, not only in docs: `@cwmb/protocol` now exports the first shared `CatalogContract`, `TurnContext`, `ExecuteRequest`, `ExecuteResponse`, `ToolDecision`, and `ResultEnvelope` surfaces with matching schemas/tests.
- `/tools` now materializes Phase 1 catalog metadata (`catalogVersion`, `generatedAt`, `workspaceRoot`) while preserving the existing `tools` array that current userscript consumers already expect.
- `/call-tool` now attaches compatibility execution metadata under a nested `execute` object, so current userscript code keeps the legacy top-level `result` while Phase 1 consumers can still read `requestId`, `executionId`, `decisions`, and structured result-envelope metadata.
- Shared compat parsing no longer accepts the earlier flat top-level `requestId` / `executionId` / `decisions` / `result` execute shape; that transition-only form was not part of the live runtime floor and is now intentionally inert.
- Userscript-side request construction now goes through shared protocol compat helpers instead of repeating local `ToolCallRequest` assembly in multiple files.
- Userscript-side gateway handling now reads `execute` compat metadata through shared helpers on both success and failure paths.
- Userscript `callTool()` now treats nested `execute` metadata as required on the live `/call-tool` path and raises `INVALID_GATEWAY_RESPONSE` if the gateway payload omits or corrupts it.
- Shared protocol now owns the current `tool_result_batch` item union and batch envelope helper, including the compat `source.messageId` field used by userscript result insertion.
- Userscript single-result insertion now formats shared `inline_tool_result` / `execution_error` envelopes instead of serializing raw legacy single-call payloads directly.
- Userscript batch execution now returns the shared batch envelope shape instead of a local duplicate interface, and batch result formatting consumes the shared envelope directly.
- App-local `lint`, `test`, and `build` scripts for `apps/userscript` and `apps/gateway` now rebuild required workspace package outputs first, so new `@cwmb/protocol` / `@cwmb/shared` exports do not depend on manual build ordering.

## Verified Reference Baseline

- The current runtime baseline has user-confirmed real-page validation for the browser-to-gateway flow.
- The current runtime baseline already includes:
  - hidden request-layer catalog injection
  - `/tools` and `mcp_list` catalog alignment
  - invalid-turn enforcement with recoverable-noise handling
  - startup/history rescan of the latest open assistant MCP turn
  - execute / insert / send automation semantics
  - trusted-local default gateway flow
- Root `pnpm -r lint`, `pnpm -r test`, and `pnpm -r build` previously succeeded for the documented baseline implementation.
- On April 27, 2026, after seeding the Phase 1 contract surfaces, `pnpm lint`, `pnpm test`, and `pnpm build` succeeded again for the repo.
- After the Stage 4 compat slice above, root `pnpm lint`, `pnpm test`, and `pnpm build` succeeded again with the updated app-local dependency-build workflow.
- After converging the shared batch envelope and userscript result-delivery shape, root `pnpm lint`, `pnpm test`, and `pnpm build` succeeded again.
- After dropping flat execute-metadata fallback from the shared compat helper and keeping only nested `execute`, root `pnpm lint`, `pnpm test`, and `pnpm build` succeeded again.
- After requiring valid nested `execute` metadata on the live userscript `/call-tool` path, root `pnpm lint`, `pnpm test`, and `pnpm build` succeeded again.

## Active Stop Line

- The v0.1 stop line is closed as of April 27, 2026.
- The current program gate is no longer v0.1 acceptance. The next gate is to complete and begin executing a concrete Phase 1 shared-contract freeze without breaking the proven runtime baseline by accident.
- Until explicitly migrated, the active compatibility floor includes:
  - `/health`
  - `/tools`
  - `/call-tool`
  - hidden request-layer injection
  - invalid-turn enforcement
  - startup/history rescan
  - execute / insert / send runtime semantics

## Active Slice

- Slice name: Phase 1 shared-contract freeze
- Primary battleground: Final Core
- Immediate implementation surfaces:
  - `packages/protocol/*`
  - narrow gateway route adapters
  - current userscript protocol consumers
  - `apps/extension/src/chatgpt-adapter/*`
  - `docs/protocols/*`
  - `docs/operations/chatgpt-web-runtime-evidence.md`
- Explicitly not open in this slice:
  - extension-first shell migration
  - gateway execution-kernel extraction
  - `reviewed` / `yolo` rollout
  - proposal workflow rollout
  - external/custom MCP rollout
  - broad builtin capability expansion

## Caveats

- The repo still lacks browser-driven end-to-end automation, so browser-runtime transitions will continue to need real ChatGPT Web verification.
- The active codebase is still userscript-first today; the v0.9 architecture and protocol docs are active target truth, not evidence that the refactor already happened.
- The unified ChatGPT Web runtime evidence doc exists now, but it is not yet a fully populated evidence pack; DOM-heavy work should refresh or add evidence there before expanding.
- The extension target skeleton exists only for page-fact ownership right now; this is not blanket authorization to migrate broader browser runtime logic into `apps/extension` yet.
- Later-scope capabilities remain target-state work rather than shipped behavior:
  - `reviewed` / `yolo`
  - full proposal workflow
  - `run_pwsh` as a shipped capability
  - external/custom MCP as a shipped extension ring
  - Chrome Extension as the primary browser shell

## Next Handoff

- Use `docs/v0.9-entrypoint.md` first when deciding where new v0.9 truth belongs.
- Use `docs/prd.md` only as the closed reference baseline for the current proven runtime.
- Start concrete work from the Phase 1 shared-contract freeze.
- If a change depends on ChatGPT Web DOM/request-shape/selectors facts, put the raw evidence in `docs/operations/chatgpt-web-runtime-evidence.md` instead of scattering it through task docs.
- If code needs ChatGPT Web page facts, add or update them in `apps/extension/src/chatgpt-adapter/` first, then adapt current userscript consumers through compat wiring.
- Do not add or keep adapters only to preserve draft-only field names, draft wording, or other reference-only shapes. Keep compatibility only where current live runtime behavior still depends on it.
- Treat nested `execute` as the only active `/call-tool` execution-metadata compat surface unless a future task doc explicitly reopens that decision with live runtime evidence.
- The next useful narrowing step is to decide whether the gateway route and shared protocol package should expose a first-class live `/call-tool` response type instead of overloading one compat alias for both raw boundary parsing and validated runtime payloads.
- If a change tries to expand into extraction or capability rollout, stop and either narrow it back to this slice or first update the task-control docs with a new active slice.
