# Gateway Kernel

## 0. Document Status

- Status: draft v1
- Owner: `apps/gateway`
- Scope: execution semantics, policy, registry, shell, proposal, external MCP, and shared gateway infrastructure

This document expands the gateway-owned half of the target architecture. It does not define ChatGPT DOM or page runtime behavior.

## 1. Purpose

The gateway kernel exists to own:

- tool registry and catalog materialization
- execution orchestration
- policy decisions
- builtin tool execution
- proposal handling
- shell execution
- external MCP lifecycle and proxying
- result caching
- audit
- diagnostics

The gateway kernel is not allowed to infer ChatGPT page state or own browser-side runtime orchestration.

## 2. Module Layout

```text
apps/gateway/src/
├─ api/
├─ execution-kernel/
├─ tool-registry/
├─ tool-policy/
├─ builtin-tools/
├─ proposal-engine/
├─ shell-runtime/
├─ external-mcp/
├─ result-cache/
├─ audit-log/
├─ diagnostics/
└─ main/
```

## 3. Module Boundaries

### 3.1 `api`

Owns:

- route handling
- request validation
- auth/origin checks
- response shaping

Does not own:

- tool execution
- catalog materialization logic
- policy logic

### 3.2 `execution-kernel`

Owns:

- the only execution orchestration entrypoint
- batch execution coordination
- executor selection
- result aggregation
- audit/cache context propagation

Does not own:

- page-state inference
- tool-level policy authoring
- proposal business rules
- shell command guard rules
- external transport details

Kernel rule:

- all execution must flow through the kernel

### 3.3 `tool-registry`

Owns:

- builtin tool aggregation
- external tool aggregation
- namespace normalization
- materialized catalog production

Does not own:

- per-call execution decisions
- tool invocation

### 3.4 `tool-policy`

Owns:

- workspace hard policy
- mode-aware policy branching
- risk-aware decision output
- tool-level policy envelope evaluation

Does not own:

- tool execution
- proposal storage
- DOM/runtime concerns

Policy rule:

- conversation mode selects a branch inside the tool policy envelope
- workspace hard policy remains the absolute ceiling
- `yolo` does not globally bypass tool-level policy

### 3.5 `builtin-tools`

Owns:

- structured builtin tool implementations

Does not own:

- final policy decisions
- route handling
- standalone audit truth

### 3.6 `proposal-engine`

Owns:

- proposal creation
- proposal storage
- apply/discard flow
- apply-time conflict recheck

Does not own:

- the decision that a write-capable call must become a proposal
- operator-facing UI

### 3.7 `shell-runtime`

Owns:

- `run_pwsh`
- command guarding
- `cwd`/env shaping
- timeout control
- stdout/stderr capture

Does not own:

- whether the call is allowed to run
- workspace hard policy
- final audit conclusions

`run_pwsh` rule:

- it is a target-state power tool
- it is mode-gated
- it does not replace the builtin-first capability strategy

### 3.8 `external-mcp`

Owns:

- server registry
- lifecycle management
- transport adapters
- raw tool proxying
- transport-error normalization

Does not own:

- final visibility/callable decisions
- browser-side runtime state

### 3.9 `result-cache`

Owns:

- large result storage
- paging
- lookup
- expiry

Does not own:

- page runtime concepts
- operator UI decisions

### 3.10 `audit-log`

Owns:

- execution audit
- policy audit
- lifecycle audit
- apply audit

Does not own:

- browser-side presentation formatting

### 3.11 `diagnostics`

Owns:

- health snapshots
- redacted diagnostics bundles
- aggregated operator-facing diagnostic truth

Does not own:

- execution control

## 4. Gateway Dependency Rules

Allowed high-level direction:

```text
api -> execution-kernel
execution-kernel -> tool-policy + tool-registry + executors
executors -> result-cache/audit-log through kernel-owned context
diagnostics -> read-only aggregation
```

Forbidden direction:

- `api` directly calling builtin tools
- `tool-policy` directly executing tools
- executors bypassing the kernel
- `diagnostics` becoming a control plane

## 5. Capability Strategy

### 5.1 Builtin First

High-frequency repo-local actions should become builtin where possible.

### 5.2 Shell As Power Tool

`run_task` remains the preferred structured path for repeated and stable workflow actions.

`run_pwsh` is the fallback power-tool plane for:

- low-frequency compositional work
- repo-specific scripts
- environment debugging
- cases not yet worth builtin modeling

### 5.3 External MCP As Extension Ring

External MCP is a pluggable extension ring. It must consume the same:

- policy system
- result model
- audit context
- catalog materialization rules

It must not redefine the core execution architecture.

## 6. Gateway-Owned State

Gateway-owned truth includes:

- workspace hard policy
- materialized catalog
- proposal store
- execution history
- result cache
- external server lifecycle
- trusted-local/token/host policy

The gateway does not own:

- conversation-scoped execution profile as browser runtime state
- latest open assistant turn
- DOM/runtime delivery status

## 7. Related Documents

- [v0.9-target-architecture.md](./v0.9-target-architecture.md)
- [migration-boundaries.md](./migration-boundaries.md)
- [../protocols/catalog-contract.md](../protocols/catalog-contract.md)
- [../protocols/execution-contract.md](../protocols/execution-contract.md)
- [../protocols/result-envelope.md](../protocols/result-envelope.md)
- [../protocols/policy-decision.md](../protocols/policy-decision.md)
