# Policy Decision

## 0. Document Status

- Status: draft v1
- Owner: gateway `tool-policy`
- Used by: gateway execution kernel, extension operator panel, future contract tests

This document defines the minimum decision model shared between policy evaluation and execution/reporting.

## 1. Purpose

Policy decisions must be explicit outputs. The system must not force the browser runtime or operators to infer allow/deny semantics from generic error messages.

## 2. Decision Surface

The minimum decision surface must distinguish:

- execute
- proposal required
- confirmation required
- deny
- skip

These are distinct outcomes and must not be collapsed into a generic blocked/error state.

## 3. Inputs To Policy

A policy decision may depend on:

- workspace hard policy
- conversation execution profile
- tool-level base policy envelope
- tool risk
- normalized arguments
- operator intent

## 4. Precedence Rules

### 4.1 Workspace Hard Policy Is The Ceiling

No conversation mode may override workspace hard policy.

### 4.2 Tool Policy Envelope Stays In Force

Conversation mode selects a branch inside the tool policy envelope. It does not globally disable tool-level constraints.

This means:

- some tools may still require confirmation in `yolo`
- some tools may still be denied in `yolo`
- some tools may be proposal-oriented in `reviewed` and directly executable in `yolo`

### 4.3 Mode Does Not Replace Policy

`reviewed` and `yolo` are execution profiles, not standalone policy systems.

## 5. Minimum Decision Payload

A policy decision must include at least:

- call identity
- final action
- stable reason code
- risk classification
- human-facing explanation

Optional audit linkage may be included when available.

## 6. Invariants

- deny and skip must remain distinct
- proposal-required and confirm-required must remain distinct
- policy decisions happen before execution
- policy decisions are part of auditable execution truth

## 7. Compatibility Rules

- new reason codes may be added
- existing high-level final actions must remain stable unless an approved contract migration exists

## 8. Related Documents

- [execution-contract.md](./execution-contract.md)
- [result-envelope.md](./result-envelope.md)
- [../architecture/v0.9-target-architecture.md](../architecture/v0.9-target-architecture.md)
