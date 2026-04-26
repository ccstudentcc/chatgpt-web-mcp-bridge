# Implementation Plan

## Stage 1: Contract And Gap Review

Status: completed

- Re-read the PRD sections covering multi-block detection, result insertion, and userscript UI states.
- Confirm that the repo still only executed `state.pending[0]`, so the approved batch flow was a real implementation gap.
- Keep the single-tool path unchanged and scope the change to same-reply multi-block handling.

## Stage 2: Userscript Batch Implementation

Status: completed

- Add a pure batch execution module to compute `batchId`, execute tool calls in order, stop on failure, and build a `tool_result_batch` payload.
- Extend userscript state and UI for batch detection, progress display, and final batch insertion.
- Wire scan, `Run All`, ignore, and de-duplication behavior into `chatgpt-mcp-bridge.user.ts`.
- Reuse the existing insertion path while adding a dedicated batch formatter.

## Stage 3: Verification

Status: completed

- Build `@cwmb/protocol` so its workspace entrypoints exist for userscript validation.
- Run `pnpm --filter @cwmb/userscript lint`.
- Run `pnpm --filter @cwmb/userscript test`.
- Run `pnpm --filter @cwmb/userscript build`.

## Risks

- The userscript still infers message identity from DOM attributes or text snapshots, so ChatGPT DOM changes could affect batch de-duplication quality.
- Batch stop-on-failure now exists only in the userscript layer; gateway responses remain single-tool shaped by design.
- Future UI work may want a visible retry path for stopped batches, but that is intentionally out of scope for this slice.
