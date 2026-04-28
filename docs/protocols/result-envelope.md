# Result Envelope

## 0. Document Status

- Status: draft v1
- Owner: gateway `execution-kernel`
- Used by: gateway execution kernel, extension result delivery, future contract tests

This document defines the minimum result-envelope family shared between the browser runtime and the gateway.

## 1. Purpose

The result envelope exists so that the gateway can return structured outcomes without forcing the browser runtime to infer semantics from arbitrary output strings.

## 2. Result Families

The minimum result family must distinguish:

- inline tool result
- batch result
- proposal result
- cached reference
- execution error

Current repo truth requires `tool_result_batch` to remain a first-class result family, not an incidental variant hidden inside generic tool output.

Current implementation note:

- `/call-tool` compatibility responses now attach either an inline tool-result envelope or an execution-error envelope under a nested `execute.result`, browser-runtime single-result insertion formats that shared envelope shape instead of raw legacy single-call payloads, and the live browser-runtime path now treats a missing/malformed nested `execute` object as a protocol error.
- Shared protocol typing now keeps that raw compat boundary distinct from the validated live `/call-tool` response shape that gateway and browser-runtime code consume after execute-metadata checks pass.
- The current `tool_result_batch` envelope is now shared in `@cwmb/result-model`, including per-item success/failure/skipped variants and the compat `source.messageId` field still used by userscript result insertion.

## 3. Minimum Semantics

### 3.1 Inline Tool Result

Must identify:

- the tool call
- success or failure at the tool-result level
- structured output payload
- human-facing summary

### 3.2 Batch Result

Must identify:

- the batch/execution
- one or more per-item outcomes
- a batch summary

### 3.3 Proposal Result

Must identify:

- proposal identity
- proposal lifecycle status
- affected files summary

### 3.4 Cached Reference

Must identify:

- cache result id
- summary
- total size or equivalent scale signal
- preview when available

### 3.5 Execution Error

Must identify:

- error code
- summary
- retryability

Execution errors must not be used to hide policy decisions. Policy refusal remains a decision outcome, not an execution-error substitute.

## 4. Invariants

- result delivery consumes envelopes; it does not reinterpret execution meaning
- large outputs should become cached references instead of forcing unbounded inline payloads
- proposal outcomes must remain distinct from normal inline tool results
- batch semantics must remain explicit

## 5. Compatibility Rules

- new result families may be added later, but existing first-class families must not be collapsed into generic output blobs
- migration work must preserve current `tool_result_batch` compatibility until an approved replacement contract exists

## 6. Related Documents

- [execution-contract.md](./execution-contract.md)
- [policy-decision.md](./policy-decision.md)
- [../architecture/v0.9-target-architecture.md](../architecture/v0.9-target-architecture.md)
