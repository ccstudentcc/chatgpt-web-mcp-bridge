# Implementation Plan

## Stage 1: Control Surface And Repo Policy

Status: completed

- Add `.gitattributes` for LF normalization.
- Add `tmp/` to `.gitignore`.
- Create task control docs for this PRD-driven phase.

## Stage 2: Gateway Read-Only Tool Completion

Status: completed

- Implement `apps/gateway/src/tools/search-files.ts`.
- Update `apps/gateway/src/tools/grep-files.ts` to support `glob`, explicit result counts, and clearer truncation metadata.
- Keep the existing disabled placeholders for write and shell tools unchanged.

## Stage 3: Validation

Status: completed

- Add focused Vitest coverage for `search_files` and `grep_files`.
- Run the smallest relevant tests first.
- If workspace sandboxing blocks `pnpm`, rerun validation with escalation and record that boundary in `TASK_STATUS.md`.

## Risks

- `rg` may not exist on every Windows machine, so fallback behavior must stay correct.
- Search results can grow quickly, so truncation metadata needs to remain explicit.
- Secret-like content can surface through grep matches, so redaction behavior must remain intact.
- App-level checks currently assume `@cwmb/shared` and `@cwmb/protocol` have been built first so their `dist/` entrypoints exist.
