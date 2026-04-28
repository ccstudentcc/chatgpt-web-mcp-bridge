# Tool Policy

## 0. Document Status

- Status: draft v2
- Owner: gateway `tool-policy`
- Scope: operator-facing policy semantics, current shipped reading, and target-state authority boundaries

## 1. Purpose

This document separates two layers on purpose:

- current live operator-facing signals in the shipped v0.1 bridge
- richer target-state policy vocabulary used by the v0.9 planning docs

## 2. Current v0.1 Reading Before You Read The Vocabulary Literally

This repo now uses target-state policy vocabulary earlier than it ships the full target-state policy engine.

Current live reminders:

- `/tools` is still the operator-facing source of truth for what is currently enabled or callable
- low-risk read tools are the current automatic path
- `write_file` is the only shipped high-risk builtin and stays manual-only even when enabled
- `run_pwsh`, full proposal workflows, and richer mode routing remain target-state planning items unless task-control docs explicitly say otherwise
- gateway pre-execution tool assessment plus workspace hard-path policy now live under `apps/gateway/src/tool-policy/{call-policy,path-policy}.ts`

Current live signals are narrower than the target policy model:

- `/tools` exposes `enabled`, `risk`, `description`, and `requiresConfirmation`
- `/call-tool` currently returns success/failure plus concrete error codes such as `TOOL_DISABLED`, `PWSH_DISABLED`, `BLOCKED_PATH`, or `PATH_OUTSIDE_WORKSPACE`
- batch-level `skip` is currently a userscript aggregation/result-delivery outcome after an earlier failure, not a gateway-native `PolicyDecision` object

## 3. Target-State Policy Inputs

Policy may depend on:

- workspace hard policy
- conversation execution profile
- tool-level base policy envelope
- tool risk
- normalized arguments
- operator intent

## 4. Target-State Precedence

1. workspace hard policy
2. tool-level base policy envelope
3. conversation execution profile
4. operator intent

`reviewed` and `yolo` do not replace tool policy. They select behavior within the allowed policy envelope.

## 5. Target-State Vocabulary

### `execute`

The call may run now.

### `proposal required`

The call is write-capable or otherwise side-effectful enough that the current branch requires an intermediate proposal flow.

Current note:

- this is primarily target-state vocabulary today; do not assume every current denied or manual-only call has already been converted into a shipped proposal workflow

### `confirmation required`

The call may run, but only after explicit operator confirmation.

Current note:

- `write_file` is the main current example of a high-risk action that must not auto-run

### `deny`

The call must not run under the current policy envelope.

### `skip`

The call is not executed as part of the current batch flow, but this is not the same as a hard deny.

## 6. How To Read Current v0.1 Outcomes

Use this order when a policy outcome surprises you:

1. Check `/tools` for enabled state and risk classification.
2. Check whether the tool is current shipped behavior or only mentioned in target-state docs.
3. Check the concrete `/call-tool` error or success payload before inferring richer policy semantics.
4. Check whether the operator action was auto flow, manual run, or another explicit retry path.
5. Only then decide whether the mismatch is policy, security, or browser-runtime confusion.

Typical current examples:

- `read_file` on an allowed workspace path -> `/call-tool` success
- `read_file` on `.env` or outside `workspaceRoot` -> `/call-tool` failure with a concrete path-policy error code
- `write_file` with `allowWrite=false` -> disabled/unavailable in the live catalog, not a hidden success path
- `write_file` with `allowWrite=true` -> present in the catalog as high risk with confirmation semantics, while still remaining outside the current automatic path

## 7. Related Documents

- [../prd.md](../prd.md)
- [../v0.9-entrypoint.md](../v0.9-entrypoint.md)
- [../protocols/policy-decision.md](../protocols/policy-decision.md)
- [../architecture/gateway-kernel.md](../architecture/gateway-kernel.md)
- [security.md](./security.md)
