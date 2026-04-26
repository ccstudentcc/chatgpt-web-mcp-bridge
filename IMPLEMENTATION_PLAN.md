# Implementation Plan

## Stage 1: Capability-Gap Review

Status: completed

- Re-read the PRD sections around `/tools`, disabled tools, and userscript execution gating.
- Confirm the gap: gateway already returned tool descriptors, but userscript still allowed execution without consuming the catalog.
- Keep the scope in `apps/userscript` and treat gateway descriptors as the authoritative capability source.

## Stage 2: Userscript Capability Awareness

Status: completed

- Add `/tools` fetching to the userscript gateway client.
- Store the live tool catalog in userscript state.
- Add a pure capability-assessment helper for enabled, disabled, unsupported, and catalog-unavailable tool states.
- Use that assessment in the panel so run actions only appear when the current request is executable.
- Surface risk information from the tool catalog in the panel.

## Stage 3: Verification

Status: completed

- Run `pnpm --filter @cwmb/protocol build`.
- Run `pnpm --filter @cwmb/userscript lint`.
- Run `pnpm --filter @cwmb/userscript test`.
- Run `pnpm --filter @cwmb/userscript build`.

## Risks

- Capability awareness now depends on the `/tools` fetch path, so missing or stale tokens block execution earlier and more visibly.
- The panel currently renders one summary reason for blocked execution; future UX work may want per-item details beyond the inline labels.
