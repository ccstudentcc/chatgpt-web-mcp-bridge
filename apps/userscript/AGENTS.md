# Userscript Agent Notes

## Scope

- This file applies to `apps/userscript`.

## Validation Order

- `apps/userscript` imports `@cwmb/protocol` through workspace `dist/` entrypoints.
- Before running `pnpm --filter @cwmb/userscript lint`, `test`, or `build` from a clean tree, run `pnpm --filter @cwmb/protocol build` first.

## Local Workflow

- Keep single-tool behavior intact when adding batch or queue logic; new multi-block behavior must be additive.
- Put userscript execution-state changes under `src/state.ts` and keep result formatting logic in `src/inserter.ts` or dedicated pure helper modules so focused tests can cover it without browser DOM setup.
