# Execution Contract

## 0. Document Status

- Status: draft v1
- Owner: gateway `execution-kernel`
- Used by: extension turn runtime, gateway execution kernel, future contract tests

This document defines the minimum execution request and response contract between the browser runtime and the gateway.

## 1. Purpose

The execution contract exists so that:

- the extension can submit normalized tool-call batches without embedding gateway internals
- the gateway can return explicit policy and execution outcomes without leaking ChatGPT DOM concerns
- future refactors can move runtime and execution logic without re-inventing request shape semantics

## 2. Execution Model

Execution is batch-first.

One normalized assistant turn may contain one or more tool calls. The extension submits those calls together as one execution request, and the gateway returns one structured execution response containing:

- stable request identity
- explicit policy decisions
- a structured result envelope

The browser runtime must not scatter one assistant turn into unrelated gateway calls unless the contract is explicitly extended to support that.

## 3. Minimum Request Surface

An execution request must include at least:

- stable request id
- turn context
- one or more normalized tool calls
- operator intent

Turn context must include at least:

- source assistant turn identity
- detection source
- request-layer injection context
- conversation-scoped execution profile

Each tool call must include at least:

- stable call id
- stable tool name
- arguments payload
- duplicate-guard key or equivalent stable replay identity

## 4. Minimum Response Surface

An execution response must include at least:

- request id
- execution id
- one policy decision per call
- one result envelope for the batch outcome

Policy decisions must explicitly distinguish:

- execute
- proposal required
- confirmation required
- deny
- skip

The response must not force the browser runtime to infer policy from generic error text.

Current implementation note:

- `/call-tool` now surfaces a nested compatibility `execute` object carrying `requestId`, `executionId`, `decisions`, and `result`, so early Phase 1 consumers can read shared execution metadata without overwriting the legacy top-level single-call payload.
- Flat top-level execute metadata is not part of the current compatibility contract. If the nested `execute` object is absent, consumers should treat the shared execution metadata as unavailable rather than reconstructing it from draft-only fields.

## 5. Invariants

### 5.1 Browser Runtime Owns Turn Truth

The browser runtime decides what assistant turn was detected and what normalized calls were observed. The gateway consumes that input; it does not reconstruct DOM-level turn truth.

### 5.2 Gateway Owns Execution Semantics

The gateway decides whether calls may execute, must become proposals, require confirmation, or must be denied. The extension must not make those final decisions locally.

### 5.3 Operator Intent Is Explicit

The contract must distinguish whether the execution was triggered by:

- auto flow
- manual run
- manual retry
- manual approve

This distinction must survive into policy, audit, and diagnostics.

### 5.4 Current Runtime Truth Must Stay Preserved

At the current repo stage, the execution contract must remain compatible with:

- live `/tools`-driven capability truth
- current `tool_result_batch` behavior
- invalid-turn blocking before pending execution
- startup rescan and duplicate-guard behavior

## 6. Non-Goals

This contract does not define:

- ChatGPT DOM selectors
- gateway route implementation details
- prompt text wording
- detailed UI rendering behavior

## 7. Compatibility Rules

- field additions are allowed if existing required semantics remain intact
- result-envelope evolution must preserve a first-class batch result shape
- any future route renaming must keep a documented migration path between current live contracts and target logical names

## 8. Related Documents

- [catalog-contract.md](./catalog-contract.md)
- [../architecture/v0.9-target-architecture.md](../architecture/v0.9-target-architecture.md)
- [../prd.md](../prd.md)
