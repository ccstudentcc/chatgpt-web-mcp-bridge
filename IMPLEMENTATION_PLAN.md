# Implementation Plan

## Stage 1: Automation Pivot Review

Status: completed

- Re-read the PRD/UI flow and identify the manual-control assumptions that keep `Run` and manual send in the path.
- Confirm the requested pivot: enabled v0.1 tools should auto-execute, auto-insert, and auto-send.
- Keep batch failure semantics and live capability gating intact while changing the default execution posture.

## Stage 2: Gateway + Userscript Automation Flow

Status: completed

- Expose automation flags through gateway health.
- Make the userscript consume those flags and auto-run detected pending tools when they are runnable.
- Auto-insert and auto-send successful single-tool and batch results, while keeping failure-stop + retry behavior.
- Remove `Run` / `Run All` from the default happy path and keep them only as fallback when auto-execute is off.

## Stage 3: Trusted Local Mode Default

Status: completed

- Remove pairing-token setup from the default localhost happy path.
- Make the gateway auto-create `config.json`, backfill `workspaceRoot` from the startup directory when safe, and skip token generation while trusted local mode stays on.
- Expose trusted local mode to the userscript so the panel reflects `Token: off (trusted local mode)` and hides token-only setup affordances.

## Stage 4: Verification And Close-Out

Status: completed

- Run `pnpm --filter @cwmb/gateway lint`.
- Run `pnpm --filter @cwmb/gateway test`.
- Run `pnpm --filter @cwmb/gateway build`.
- Run `pnpm --filter @cwmb/protocol build`.
- Run `pnpm --filter @cwmb/userscript lint`.
- Run `pnpm --filter @cwmb/userscript test`.
- Run `pnpm --filter @cwmb/userscript build`.
- Run `pnpm -r lint`.
- Run `pnpm -r test`.
- Run `pnpm -r build`.

## Risks

- The largest remaining risk is real-page send-button drift: auto-send depends on ChatGPT DOM selectors remaining stable enough to click the submit control.
- Auto-execution now amplifies the impact of false-positive parsing, so DOM parsing and call deduplication correctness matter more than before.
- Trusted local mode intentionally removes token friction, so the remaining safety boundary depends more heavily on localhost-only binding, origin checks, and conservative default tool scope.
