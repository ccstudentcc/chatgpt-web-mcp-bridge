# Current Scope Spec

## Goal

Implement the approved v0.1 userscript behavior for multiple `mcp` blocks appearing in the same assistant reply.

## In Scope

- Detect when one assistant reply contains multiple valid `mcp` blocks.
- Introduce a batch execution path with one `Run All` entrypoint and serial execution order.
- Stop batch execution on the first tool failure and mark the remaining items as skipped.
- Insert one final `tool_result_batch` payload instead of partial per-tool inserts.
- Extend the userscript UI and state model for batch detection, progress, and final result handling.
- Add focused tests for ordered parsing, batch execution semantics, and batch result formatting.

## Out of Scope

- Changing gateway-side tool execution, security policy, or response schema.
- Adding auto-send, automatic multi-round loops, or parallel tool execution.
- Implementing retry UX, persistent batch history, or Chrome extension migration.

## Constraints

- Preserve the existing single-tool path and result format.
- Treat only multiple valid `mcp` blocks from the same assistant reply as one batch.
- Keep the implementation inside the existing userscript architecture without introducing a heavy framework layer.
- Keep validation focused on `@cwmb/protocol` build plus userscript lint, test, and build.

## Acceptance Criteria

- The userscript enters batch mode when the latest assistant reply contains two or more valid `mcp` blocks.
- Batch execution runs in original order via one `Run All` action and stops on the first failure.
- The final inserted content for batch mode is a single `tool_result_batch` payload with completed, failed, and skipped items.
- Duplicate DOM scans do not re-run an already executed batch in the same page session.
- Focused userscript tests cover parser order, batch stop-on-failure semantics, and batch result formatting.
