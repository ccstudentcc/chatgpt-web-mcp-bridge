# Current Scope Spec

## Goal

Implement userscript capability awareness from `/tools` so the panel only offers executable actions that the current gateway actually exposes.

## In Scope

- Fetch the token-protected `/tools` catalog from the userscript.
- Store the current tool catalog in userscript state.
- Assess pending single-tool and batch requests against the live catalog before showing `Run` or `Run All`.
- Explain disabled, unsupported, and catalog-unavailable states in the panel.
- Show risk information derived from the current tool catalog.
- Add focused tests for capability assessment.

## Out of Scope

- Changing gateway routes or tool descriptors.
- Adding browser E2E automation or visual redesign work.
- Persisting tool catalogs across reloads.

## Constraints

- Keep the gateway as the source of truth for enabled and disabled tools.
- Keep single-tool and batch execution logic intact when capability checks pass.
- Fail conservatively when the catalog is unavailable: no executable button.
- Keep capability logic in pure helpers so it is easy to unit test.

## Acceptance Criteria

- The userscript fetches `/tools` and uses it to drive executable UI state.
- Disabled or unsupported tools never show `Run` / `Run All`.
- Pending requests show risk information from the live catalog.
- Focused tests cover enabled, disabled, unsupported, and catalog-unavailable assessments.
