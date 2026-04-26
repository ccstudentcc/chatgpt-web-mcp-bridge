# Current Scope Spec

## Goal

Close the v0.1 P0 read-only tool gap described in `docs/prd.md` so the repository has a coherent minimum bridge flow for file-path search and text search.

## In Scope

- Add a repo-level line ending policy with `.gitattributes`.
- Keep project-local temp output ignored via `.gitignore`.
- Implement `search_files` in the gateway.
- Tighten `grep_files` result shape and filtering behavior to match the approved P0 contract.
- Add focused automated tests for the new or changed tool behavior.

## Out of Scope

- `write_file_proposal`, `run_pwsh`, or any write-capable flow.
- Chrome extension migration or broader userscript productization.
- Dynamic `/settings` persistence or `/logs` endpoint work.
- Large UI redesign beyond any minimal compatibility changes needed by the new tool contract.

## Constraints

- Keep all file access inside `workspaceRoot`.
- Preserve the v0.1 default safety posture: read-only tools only, no auto-send, no shell enablement.
- Match existing TypeScript + Fastify + Vitest patterns already used in the repo.
- Prefer the smallest implementation that satisfies the PRD contract.

## Acceptance Criteria

- `search_files` returns relative workspace paths, respects `glob`, enforces `maxResults`, and avoids blocked or ignored paths.
- `search_files` has a working fallback when `rg` is unavailable.
- `grep_files` returns path and line-oriented matches with explicit truncation metadata consistent with the current PRD phase.
- `grep_files` respects `glob`, `maxResults`, blocked paths, and secret redaction behavior.
- Focused tests cover the added `search_files` behavior and the updated `grep_files` truncation/filtering behavior.
- Repo text files continue to use LF line endings.
