# Current Scope Spec

## Goal

Close the remaining implementation-side v0.1 PRD gaps so the repository reaches a code-complete stop line for the documented browser-to-gateway flow.

## In Scope

- Keep the userscript aligned with the PRD around capability gating, batch execution, retry, and result insertion behavior.
- Expose the remaining required userscript configuration knobs: token, Gateway base URL, and auto-insert behavior.
- Ensure the repository-level lint, test, and build entrypoints all pass.
- Refresh README and task-control docs to reflect the actual stop line after the implementation work.

## Out of Scope

- Windows + Chrome live acceptance in a real browser session.
- P1 or later features such as `write_file_proposal`, `run_pwsh`, `apply_proposal`, or dynamic `/settings`.
- Chrome extension migration or stdio MCP adapter work.

## Constraints

- Preserve the v0.1 conservative posture: read-only tools only, no auto-send, no automatic multi-round loops.
- Treat the PRD as the authority for product semantics and keep `AGENTS.md` focused on execution rules.
- Keep verification reproducible from the repo root.

## Acceptance Criteria

- Userscript configuration exposes token, Gateway base URL, and auto-insert behavior.
- Userscript execution remains gated by live `/tools` capabilities and supports same-reply batch handling.
- Root `pnpm -r lint`, `pnpm -r test`, and `pnpm -r build` all succeed.
- Remaining work, if any, is limited to live manual acceptance rather than missing code-level v0.1 functionality.
