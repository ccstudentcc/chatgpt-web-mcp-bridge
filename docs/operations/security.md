# Security

## 0. Document Status

- Status: draft v2
- Scope: operator-facing and maintainer-facing security boundaries for the current bridge, with target-state guardrails called out explicitly

## 1. Current Security Truth

Current shipped v0.1 security truth is still defined by [../prd.md](../prd.md).

At the current repo stage, important live facts include:

- the gateway is localhost-only
- trusted local mode is the default
- ChatGPT Web `Origin` restrictions are part of the boundary
- current live tool truth comes from `/tools`
- the current shipped live route set is `/health`, `/tools`, and `/call-tool`
- current write capability is still highly constrained relative to target-state plans
- workspace hard-path enforcement now routes through `apps/gateway/src/tool-policy/path-policy.ts`

Trusted local mode is not equivalent to trusting arbitrary webpages. It reduces local token friction for the intended ChatGPT Web flow, but it does not remove host binding, origin checks, or conservative policy boundaries.

## 2. What Trusted Local Mode Does And Does Not Mean

Trusted local mode means:

- the intended ChatGPT Web origin path can talk to the localhost gateway without a pairing token
- local operator setup is simpler during normal v0.1 use

Trusted local mode does not mean:

- arbitrary webpages are trusted
- localhost binding can widen
- origin checks can be relaxed
- high-risk tools become auto-runnable
- `workspaceRoot` limits stop mattering

If a change weakens host binding, origin checks, blocked-path enforcement, or write gating, that is a security regression even if trusted local mode still says "on."

## 3. Long-Term Security Principles

- workspace hard policy is the absolute ceiling
- browser runtime state does not bypass gateway policy
- fallback paths do not bypass policy or audit
- external MCP must stay more conservative by default than builtin local workflow tools
- diagnostics must be redacted by default
- current host/origin/token/workspace restrictions must be preserved during gateway modularization unless an approved migration plan says otherwise

## 4. Current Gateway Boundary That Refactors Must Preserve

Gateway refactors must preserve the combined baseline, not just one piece of it:

- localhost-only binding
- ChatGPT Web `Origin` restrictions
- trusted local mode default
- token fallback when trusted local mode is disabled
- workspace and sensitive-path enforcement

Weakening one of these while keeping the others is still a security regression.

## 5. Current v0.1 Security Reading

Important current-state reminders:

- `/tools` is the live callable truth; a tool that is absent or disabled there is not available just because a target-state doc mentions it
- `write_file` is still optional, off by default, and manual-only when enabled
- `run_pwsh` remains outside the current shipped v0.1 capability surface
- current refactors must preserve the localhost/origin/trusted-local/workspace baseline before they pursue target-state modularity

## 6. Execution Profiles

`reviewed`:

- operator-mediated mode
- important side effects do not land automatically by default

`yolo`:

- high-autonomy mode under workspace hard limits
- does not globally disable tool policy

The profile names below are target-state planning vocabulary unless current task docs explicitly promote them into shipped behavior.

## 7. High-Risk Capability Rules

- direct shell execution is mode-gated
- direct write capability is mode-gated
- proposal-oriented flows remain available for more conservative operation
- some tools may still require confirmation or denial even in `yolo`

## 8. Security Review Triggers

Escalate a change for explicit security review if it:

- widens host binding beyond localhost
- broadens accepted origins or weakens token/trusted-local checks
- makes a previously manual-only high-risk tool auto-runnable
- weakens `workspaceRoot` or blocked-path enforcement
- exposes richer diagnostics without a redaction pass
- treats target-state mode language as permission to bypass current live policy

## 9. Related Documents

- [../prd.md](../prd.md)
- [../v0.9-entrypoint.md](../v0.9-entrypoint.md)
- [../architecture/v0.9-target-architecture.md](../architecture/v0.9-target-architecture.md)
- [tool-policy.md](./tool-policy.md)
- [gateway.md](./gateway.md)
