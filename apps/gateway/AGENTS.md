# Gateway Agent Notes

## Scope

- This file applies to `apps/gateway`.

## Ownership

- `apps/gateway/src/api/`, `execution-kernel/`, `tool-registry/`, `tool-policy/`, `builtin-tools/`, `shell-runtime/`, `proposal-engine/`, `external-mcp/`, `result-cache/`, `audit-log/`, `diagnostics/`, and `main/` are the current long-term owners for gateway logic or target-structure composition.
- `apps/gateway/src/routes/`, `tools/`, `shell/`, `security/`, `utils/`, `server.ts`, and `index.ts` are still live composition or compatibility seams. Keep new long-term behavior out of those paths unless the change is translation-only.

## Working Rules

- Stage 20 `gateway-structure` is active. Land new gateway HTTP adaptation or composition work under `api/` and `main/`, and keep `routes/` plus flat entrypoints as compat shells only until Stage 21 deletes them.
- `proposal-engine/` and `external-mcp/` remain interface-plus-stub surfaces in Stage 20; do not smuggle real proposal workflow or external MCP lifecycle rollout into those directories yet.
- `result-cache/` may provide only the Stage 20 in-memory TTL implementation; do not add persistent storage, distributed coordination, or a second execution-truth path there.
- When a change affects `/health`, `/tools`, or `/call-tool`, keep the matching gateway tests and userscript consumer-path tests aligned in the same pass.
- Diagnostics should stay an observer of gateway state, config, audit, and runtime facts. Do not turn diagnostics code into a second execution-control path.

## Validation

- Prefer `pnpm --filter @cwmb/gateway lint`, `test`, and `build` for local verification; under the current Stage 18+ package layout, those scripts already rebuild `@cwmb/shared-utils`, `@cwmb/turn-model`, `@cwmb/policy-model`, `@cwmb/result-model`, and `@cwmb/tool-contracts` first.
- If you bypass those scripts with direct `vitest`, `tsx`, or `tsc` commands, rebuild those domain packages yourself before trusting the result.
- If a change touches the still-live compatibility-floor routes, rerun the matching userscript regression coverage before the wider root `pnpm lint`, `pnpm test`, and `pnpm build`.
