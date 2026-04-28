# Gateway Agent Notes

## Scope

- This file applies to `apps/gateway`.

## Ownership

- `apps/gateway/src/execution-kernel/`, `tool-registry/`, `tool-policy/`, `builtin-tools/`, `shell-runtime/`, `audit-log/`, and `diagnostics/` are the current long-term owners for extracted server-side logic.
- `apps/gateway/src/routes/`, `tools/`, `shell/`, and `utils/` are still live composition or compatibility seams. Keep new long-term behavior out of those directories unless the change is translation-only.

## Working Rules

- Stage 20 `gateway-structure` is planned but not active. Do not start `api/`, `proposal-engine/`, `external-mcp/`, `result-cache/`, or `main/` target-structure work until the task-control docs explicitly activate that stage.
- When a change affects `/health`, `/tools`, or `/call-tool`, keep the matching gateway tests and userscript consumer-path tests aligned in the same pass.
- Diagnostics should stay an observer of gateway state, config, audit, and runtime facts. Do not turn diagnostics code into a second execution-control path.

## Validation

- Prefer `pnpm --filter @cwmb/gateway lint`, `test`, and `build` for local verification; under the current Stage 18+ package layout, those scripts already rebuild `@cwmb/shared-utils`, `@cwmb/turn-model`, `@cwmb/policy-model`, `@cwmb/result-model`, and `@cwmb/tool-contracts` first.
- If you bypass those scripts with direct `vitest`, `tsx`, or `tsc` commands, rebuild those domain packages yourself before trusting the result.
- If a change touches the still-live compatibility-floor routes, rerun the matching userscript regression coverage before the wider root `pnpm lint`, `pnpm test`, and `pnpm build`.
