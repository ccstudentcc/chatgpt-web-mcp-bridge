# Implementation Plan

## Stage 1: Next-Slice Review

Status: completed

- Re-read the current userscript batch implementation and task docs.
- Confirm the two adjacent gaps already called out in `TASK_STATUS.md`: no retry path after batch failure and low-signal batch previews in the panel.
- Keep the scope inside `apps/userscript` without touching gateway contracts.

## Stage 2: Retry And Preview Implementation

Status: completed

- Add userscript state for a retryable stopped batch.
- Route both first-run and retry through the same stored-batch execution path.
- Add a pure preview helper for concise argument summaries and use it in the panel list.
- Expose `Retry whole batch` only when a stopped batch is available.

## Stage 3: Verification

Status: completed

- Run `pnpm --filter @cwmb/protocol build`.
- Run `pnpm --filter @cwmb/userscript lint`.
- Run `pnpm --filter @cwmb/userscript test`.
- Run `pnpm --filter @cwmb/userscript build`.

## Risks

- The retry path still depends on in-memory userscript state, so a page refresh clears the retryable batch.
- Argument previews are intentionally compact and may omit lower-priority args once the summary is truncated.
