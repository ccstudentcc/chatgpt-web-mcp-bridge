# ChatGPT Web MCP Bridge Agent Notes

## Scope

- This file applies to the whole repository.
- Put product behavior, protocol shape, and UX semantics in `docs/prd.md`, not here.

## Read Order

- For non-trivial work, read `docs/prd.md` first.
- If task-control docs exist, read `SPEC.md`, `IMPLEMENTATION_PLAN.md`, and `TASK_STATUS.md` before editing.

## Durable Workflow

- When a change modifies shipped behavior or validation expectations, update `docs/prd.md` and sync the task-control docs in the same pass.
- Keep repository execution rules in `AGENTS.md`; keep temporary scope, rollout status, and open questions in the task-control docs.

## Validation

- Use workspace scripts from the repo root: `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint`.
- Stage explicit file paths when committing from a dirty tree.
