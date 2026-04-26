# Task Status

## Current Truth

- The userscript now fetches `/tools` and treats the live gateway tool catalog as its execution gate.
- Pending single-tool and batch requests only show `Run` / `Run All` when every requested tool is currently enabled in the catalog.
- Disabled, unsupported, and catalog-unavailable states are explained in the panel, and risk information now comes from the live catalog.
- Existing single-tool, batch execution, and retry behavior remain intact when capability checks pass.

## Latest Verified Evidence

- `pnpm --filter @cwmb/protocol build` succeeded.
- `pnpm --filter @cwmb/userscript lint` succeeded.
- `pnpm --filter @cwmb/userscript test` succeeded with 5 passing files and 16 passing tests.
- `pnpm --filter @cwmb/userscript build` succeeded.
- New focused coverage exists for enabled, disabled, unsupported, and catalog-unavailable capability assessments.

## Next Step

- Manually exercise the userscript in ChatGPT Web against a live gateway to confirm the capability-gated panel feels correct with real `/tools` responses.
- If the next slice stays in userscript, consider exposing more detailed per-item disabled reasons or caching the last successful catalog snapshot for softer degradation.

## Caveats

- The userscript currently requires a fresh `/tools` sync to expose executable actions; if that catalog fetch fails, the panel intentionally degrades to non-executable.
- Verification is still lint, unit tests, and userscript build; no browser-driven E2E run was added in this slice.
