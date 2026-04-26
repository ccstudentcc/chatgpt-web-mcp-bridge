# Current Scope Spec

## Goal

Shift the documented v0.1 browser-to-gateway flow to an unattended default for enabled read-only tools: auto-execute, auto-insert, and auto-send.

## In Scope

- Keep the userscript aligned with the PRD around capability gating, batch execution, retry, and result insertion behavior.
- Align the gateway health/config surface and userscript runtime behavior for auto-execute, auto-insert, and auto-send.
- Remove `Run` / `Run All` from the normal happy path for enabled v0.1 tools.
- Ensure the repository-level lint, test, and build entrypoints all pass.
- Refresh README and task-control docs to reflect the actual stop line after the implementation work.

## Out of Scope

- Windows + Chrome live acceptance in a real browser session.
- P1 or later features such as `write_file_proposal`, `run_pwsh`, `apply_proposal`, or dynamic `/settings`.
- Chrome extension migration or stdio MCP adapter work.

## Constraints

- Keep the automation scope limited to gateway-enabled v0.1 read-only tools; `run_pwsh`, write flows, and other future tools remain out of scope.
- Preserve the existing batch failure rule: stop on first failure, then send one consolidated batch result.
- Treat the PRD as the authority for product semantics and keep `AGENTS.md` focused on execution rules.
- Keep verification reproducible from the repo root.

## Acceptance Criteria

- Userscript configuration/runtime reflects token, Gateway base URL, auto-execute, auto-insert, and auto-send behavior.
- Userscript execution remains gated by live `/tools` capabilities, auto-runs enabled tools, and supports same-reply batch handling.
- Root `pnpm -r lint`, `pnpm -r test`, and `pnpm -r build` all succeed.
- Remaining work, if any, is limited to live manual acceptance rather than missing code-level v0.1 functionality.
