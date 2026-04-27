# Task Status

## Current Truth

- On April 27, 2026, the user confirmed that the real signed-in ChatGPT Web flow is usable and formally closed the v0.1 stop line.
- `docs/prd.md` is now the closed v0.1 reference baseline: a useful behavior reference for the proven userscript + gateway runtime, but no longer the active product target.
- Root `SPEC.md`, `IMPLEMENTATION_PLAN.md`, and `TASK_STATUS.md` now track the active v0.9 mainline.
- `docs/v0.9-entrypoint.md` is the navigation entrypoint for that mainline; `docs/prd_vnext.md` owns the active product-boundary truth; `docs/architecture/v0.9-target-architecture.md` owns the target module-boundary truth.
- The current codebase still implements the proven userscript + gateway baseline, so v0.9 work must preserve or explicitly migrate the current live contracts rather than pretending they no longer matter.
- Phase 1 shared-contract freeze is now complete. No later extraction or capability slice has been opened yet.
- Stage 3 slice-definition work is complete; Stage 4 compat-preserving execution is complete on the same Phase 1 boundary.
- Draft v0.9 docs and draft contract shapes are reference truth only. They are not separate compatibility targets; compatibility work in the current slice applies to the proven live runtime floor and the still-live routes/behaviors it depends on.
- ChatGPT Web DOM/request-shape/selectors evidence now has one intended home: `docs/operations/chatgpt-web-runtime-evidence.md`.
- ChatGPT Web page-fact code truth now targets one v0.9 owner: `apps/extension/src/chatgpt-adapter/`; current userscript code should only consume or compat-re-export that truth.
- Request-injection mode/status helper truth now also has a narrow v0.9 target owner at `apps/extension/src/injection-runtime/`; current userscript request-hook and state code should consume it through compat wiring rather than duplicate local owner semantics.
- Browser-runtime snapshot helper truth now also has a narrow v0.9 target owner at `apps/extension/src/operator-panel/`; current userscript state code should consume it through compat wiring rather than remain the long-term owner.
- Turn-runtime helper truth now also has a narrow v0.9 target owner at `apps/extension/src/turn-runtime/`; current userscript invalid-turn state, pending-selection identity, and auto-round guard code should consume it through compat wiring rather than remain the long-term owner.
- Phase 1 implementation has started in code, not only in docs: `@cwmb/protocol` now exports the first shared `CatalogContract`, `TurnContext`, `ExecuteRequest`, `ExecuteResponse`, `ToolDecision`, and `ResultEnvelope` surfaces with matching schemas/tests.
- `@cwmb/protocol` now also exports a shared `GatewayHealthContract` and browser-local `GatewayRuntimeSnapshot`, so gateway reachability/config truth can live beside catalog truth without userscript-only field drift.
- `/tools` now materializes Phase 1 catalog metadata (`catalogVersion`, `generatedAt`, `workspaceRoot`) while preserving the existing `tools` array that current userscript consumers already expect.
- `/health` is now validated through the shared contract before userscript applies automation defaults; the earlier local `shell: string` typing drift is gone, and shell diagnostics now stay structured end-to-end.
- `/call-tool` now attaches compatibility execution metadata under a nested `execute` object, so current userscript code keeps the legacy top-level `result` while Phase 1 consumers can still read `requestId`, `executionId`, `decisions`, and structured result-envelope metadata.
- Shared compat parsing no longer accepts the earlier flat top-level `requestId` / `executionId` / `decisions` / `result` execute shape; that transition-only form was not part of the live runtime floor and is now intentionally inert.
- Userscript-side request construction now goes through shared protocol compat helpers instead of repeating local `ToolCallRequest` assembly in multiple files.
- Userscript-side gateway handling now reads `execute` compat metadata through shared helpers on both success and failure paths.
- Userscript `callTool()` now treats nested `execute` metadata as required on the live `/call-tool` path and raises `INVALID_GATEWAY_RESPONSE` if the gateway payload omits or corrupts it.
- Shared protocol now distinguishes raw `/call-tool` boundary payloads from validated live `/call-tool` responses with a first-class live response type, so gateway/userscript code no longer rely on one overloaded compat alias for both meanings.
- Userscript `/tools` fetching now validates the full `CatalogContract` before reading `.tools`, so malformed catalog payloads fail as `INVALID_GATEWAY_RESPONSE` instead of silently degrading to an empty tool list.
- Userscript cache/bootstrap/runtime state now retain the full catalog contract instead of only `tools[]`, so `catalogVersion` and `workspaceRoot` are available for diagnostics without another shape migration later.
- Userscript panel/runtime state now also tracks whether the visible catalog came from the live gateway or cached bootstrap, so diagnostics can distinguish “catalog known” from “catalog freshly synced”.
- Userscript runtime state now stores one shared runtime snapshot for validated `/health` plus current catalog truth, while still distinguishing live catalog sync from cached bootstrap catalog warmup.
- Pure request-injection mode/status semantics now live under `apps/extension/src/injection-runtime/request-injection-state.ts`, while userscript keeps only thin compat re-exports and algorithm-local request-hook logic.
- The pure runtime-snapshot helper semantics have been lifted out of userscript-local state code into `apps/extension/src/operator-panel/runtime-snapshot.ts`, while `apps/userscript/src/runtime-snapshot.ts` remains a thin compat re-export.
- Pure invalid-turn state, pending-selection identity, and auto-round guard semantics now live under `apps/extension/src/turn-runtime/*`, while userscript `detection-state.ts`, `round-guard.ts`, and `turn-runtime.ts` only provide compat wiring or local type adaptation.
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
- After splitting raw compat parsing from the first-class live `/call-tool` response type, root `pnpm lint`, `pnpm test`, and `pnpm build` succeeded again.
- After requiring a valid `CatalogContract` on the live userscript `/tools` path, root `pnpm lint`, `pnpm test`, and `pnpm build` succeeded again.
- After promoting the userscript cache/state layer from `tools[]` to the full catalog contract, root `pnpm lint`, `pnpm test`, and `pnpm build` succeeded again.
- After surfacing live-vs-cache catalog provenance in userscript state/UI, root `pnpm lint`, `pnpm test`, and `pnpm build` succeeded again.
- After introducing the shared `/health` contract and runtime snapshot state, `pnpm --filter @cwmb/protocol test`, `build`, `pnpm --filter @cwmb/gateway test`, and `pnpm --filter @cwmb/userscript lint`, `test`, `build` succeeded again.
- After seeding the extension `injection-runtime` request-injection state owner and switching userscript to compat re-exports, root `pnpm lint`, `pnpm test`, and `pnpm build` succeeded again.
- After seeding the extension `operator-panel` runtime-snapshot owner and switching userscript to a compat re-export, root `pnpm lint`, `pnpm test`, and `pnpm build` succeeded again.
- After seeding the extension `turn-runtime` helper owner and switching userscript invalid-turn / round-guard helpers to compat wiring, root `pnpm lint`, `pnpm test`, and `pnpm build` succeeded again.

## Active Stop Line

- The v0.1 stop line is closed as of April 27, 2026.
- The current program gate is no longer v0.1 acceptance, and Phase 1 shared-contract freeze is no longer open. The next gate is to choose and document the first post-Phase-1 extraction-focused Final Core slice without accidentally broadening into capability rollout.
- Until explicitly migrated, the active compatibility floor includes:
  - `/health`
  - `/tools`
  - `/call-tool`
  - hidden request-layer injection
  - invalid-turn enforcement
  - startup/history rescan
  - execute / insert / send runtime semantics

## Active Slice

- Most recently completed slice: Phase 1 shared-contract freeze
- Battleground used: Final Core
- Completed implementation surfaces:
  - `packages/protocol/*`
  - narrow gateway route adapters
  - current userscript protocol consumers
  - `apps/extension/src/chatgpt-adapter/*`
  - `apps/extension/src/injection-runtime/*`
  - `apps/extension/src/operator-panel/*`
  - `apps/extension/src/turn-runtime/*`
  - `docs/protocols/*`
  - `docs/operations/chatgpt-web-runtime-evidence.md`
- Still explicitly not opened by completing Phase 1:
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
- The extension target skeleton now covers page-fact ownership plus narrow request-injection, runtime-snapshot, and turn-runtime helper ownership only; this is still not blanket authorization to migrate broader browser runtime logic into `apps/extension` yet.
- Later-scope capabilities remain target-state work rather than shipped behavior:
  - `reviewed` / `yolo`
  - full proposal workflow
  - `run_pwsh` as a shipped capability
  - external/custom MCP as a shipped extension ring
  - Chrome Extension as the primary browser shell

## Next Handoff

- Use `docs/v0.9-entrypoint.md` first when deciding where new v0.9 truth belongs.
- Use `docs/prd.md` only as the closed reference baseline for the current proven runtime.
- Do not reopen Phase 1 implicitly. Start the next round by documenting the next active slice first.
- If a change depends on ChatGPT Web DOM/request-shape/selectors facts, put the raw evidence in `docs/operations/chatgpt-web-runtime-evidence.md` instead of scattering it through task docs.
- If code needs ChatGPT Web page facts, add or update them in `apps/extension/src/chatgpt-adapter/` first, then adapt current userscript consumers through compat wiring.
- Do not add or keep adapters only to preserve draft-only field names, draft wording, or other reference-only shapes. Keep compatibility only where current live runtime behavior still depends on it.
- Treat nested `execute` as the only active `/call-tool` execution-metadata compat surface unless a future task doc explicitly reopens that decision with live runtime evidence.
- The next useful narrowing step is to decide whether `parser.ts`-level turn normalization itself should start moving behind an extension `turn-runtime` owner seam as the first post-Phase-1 extraction slice.
- If a change tries to expand into extraction or capability rollout, stop and either narrow it back to this slice or first update the task-control docs with a new active slice.
