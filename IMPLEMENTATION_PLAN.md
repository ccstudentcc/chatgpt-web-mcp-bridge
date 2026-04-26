# Implementation Plan

## Stage 1: Remaining v0.1 Gap Review

Status: completed

- Re-read the PRD stop line and compare it against the current gateway and userscript code.
- Confirm the remaining code-side gaps were userscript configuration coverage and repository-level validation health.
- Distinguish code-complete work from live manual acceptance work.

## Stage 2: Final Userscript And Validation Work

Status: completed

- Add live `/tools` capability gating to the userscript panel.
- Add userscript settings coverage for Gateway base URL and auto-insert behavior.
- Add manual `Insert result` handling for `result_ready` and `batch_result_ready`.
- Add the minimum shared-package test coverage needed for root test health.

## Stage 3: Verification And Close-Out

Status: completed

- Run `pnpm --filter @cwmb/protocol build`.
- Run `pnpm --filter @cwmb/userscript lint`.
- Run `pnpm --filter @cwmb/userscript test`.
- Run `pnpm --filter @cwmb/userscript build`.
- Run `pnpm -r lint`.
- Run `pnpm -r test`.
- Run `pnpm -r build`.

## Risks

- The remaining v0.1 gap is now primarily live acceptance risk: ChatGPT DOM drift, real browser behavior, and Windows-specific manual validation.
- The userscript still degrades conservatively when `/tools` cannot be fetched, which is correct for safety but may feel strict in transient token or network-error states.
