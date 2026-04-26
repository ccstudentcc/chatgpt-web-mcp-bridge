# Task Status

## Current Truth

- The userscript still uses the same same-reply batch execution contract introduced in the previous slice.
- After a batch stops on failure, the panel now keeps a retryable batch snapshot and exposes `Retry whole batch`.
- Batch previews in the panel now show concise argument summaries instead of only tool names.
- Single-tool behavior and gateway contracts remain unchanged.

## Latest Verified Evidence

- `pnpm --filter @cwmb/protocol build` succeeded.
- `pnpm --filter @cwmb/userscript lint` succeeded.
- `pnpm --filter @cwmb/userscript test` succeeded with 4 passing files and 11 passing tests.
- `pnpm --filter @cwmb/userscript build` succeeded.
- New focused coverage exists for preview summaries and ordered batch progress callbacks.

## Next Step

- Manually exercise the userscript in ChatGPT Web to confirm the retry button and richer previews feel correct against the live DOM.
- If the next slice stays in userscript, consider preserving retryable batches across soft reloads or adding a more explicit per-item failure summary in the panel.

## Caveats

- Retryable batches are stored only in in-memory userscript state and do not survive a page refresh.
- Verification is still lint, unit tests, and userscript build; no browser-driven E2E run was added in this slice.
