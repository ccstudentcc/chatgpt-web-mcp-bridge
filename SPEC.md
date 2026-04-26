# Current Scope Spec

## Goal

Finish the next userscript polish slice after same-reply batch execution by exposing retry UX for stopped batches and making pending batch previews more informative.

## In Scope

- Preserve the existing batch execution contract and stop-on-first-failure behavior.
- Keep a retryable stopped-batch snapshot in userscript state.
- Expose a `Retry whole batch` action after batch failure.
- Show richer pending batch previews with concise argument summaries instead of tool names alone.
- Add focused tests for preview formatting and batch progress ordering.

## Out of Scope

- Changing gateway behavior or the `tool_result_batch` schema.
- Adding browser-driven E2E automation, auto-send, or background retries.
- Redesigning the panel visual style beyond the new preview and retry controls.

## Constraints

- Preserve the single-tool path and keep multi-block behavior additive.
- Reuse the existing batch execution path for both first-run and retry flows.
- Keep preview logic in pure helpers so focused tests can cover it without DOM harnesses.
- Keep validation focused on `@cwmb/protocol` build plus userscript lint, test, and build.

## Acceptance Criteria

- After a batch stops on failure, the panel exposes `Retry whole batch` without requiring the assistant message to be re-detected.
- Retrying a stopped batch reuses the original batch order and final insertion flow.
- Pending batch entries show concise argument previews in the panel.
- Focused tests cover preview summaries and ordered batch progress callbacks.
