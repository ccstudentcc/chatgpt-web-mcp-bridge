# Userscript Agent Notes

## Scope

- This file applies to `apps/userscript`.

## Role

- `apps/userscript` is the live compatibility carrier and behavior reference baseline until Stage 21 archives it; it is not the target v0.9 long-term owner.
- When logic already has a v0.9 owner under `apps/extension/src/chatgpt-adapter/`, `injection-runtime/`, `operator-panel/`, `result-delivery/`, or `turn-runtime/`, keep userscript edits limited to compat wiring, runtime-shell orchestration, and reference tests.

## Validation Order

- Under the current pre-Stage-18 package layout, `apps/userscript` imports `@cwmb/protocol` through workspace `dist/` entrypoints and also consumes source files under `../extension/src/*`.
- Before running `pnpm --filter @cwmb/userscript lint`, `test`, or `build` from a clean tree, run `pnpm --filter @cwmb/protocol build` first.
- If the change touches extension-owned modules that userscript consumes, include the same userscript verification because this package is still the live executable browser surface.

## Local Workflow

- Keep single-tool behavior intact when adding batch or queue logic; new multi-block behavior must be additive.
- Keep `src/chatgpt-mcp-bridge.user.ts`, `src/request-hook.ts`, `src/state.ts`, and `src/ui.ts` focused on runtime-shell orchestration. Do not grow new long-term page facts, prompt-contract truth, panel-state truth, or turn-runtime truth directly under `apps/userscript/src`.
