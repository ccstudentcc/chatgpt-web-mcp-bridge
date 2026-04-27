# Gateway Runtime Contract

## 0. Document Status

- Status: draft v1
- Owner: gateway route layer plus browser runtime client
- Used by: userscript state, future extension compat state, operator diagnostics

This document defines the shared runtime contract around gateway reachability/config truth and the browser-local snapshot that aggregates it with catalog truth.

## 1. Purpose

The runtime contract exists to prevent the browser runtime from carrying a second ad hoc copy of gateway health fields beside the shared catalog contract.

It provides one shared vocabulary for:

- `/health` response validation
- browser-runtime automation defaults
- workspace and shell diagnostics
- the browser-local snapshot that combines validated health and catalog truth

## 2. Current Canonical Reality

At the current repo stage:

- `/health` remains the canonical live health and gateway-status route
- `/tools` remains the canonical live catalog route
- the browser runtime may aggregate those validated contracts into one local `GatewayRuntimeSnapshot`
- that snapshot is local state only, not a replacement route and not a silent rename of `/health` or `/tools`

Current implementation note:

- the gateway now serves a shared `GatewayHealthContract` on `/health`
- the userscript now validates `/health` before applying automation defaults
- the userscript state now stores a `GatewayRuntimeSnapshot` that can hold:
  - live health truth from `/health`
  - catalog truth from `/tools`
  - whether the visible catalog is live or cached bootstrap data
- the narrow target owner for pure browser-side runtime-snapshot helper semantics is now seeded at `apps/extension/src/operator-panel/runtime-snapshot.ts`, with current userscript code consuming it through a compat re-export

## 3. Minimum Contract Surface

`GatewayHealthContract` must include at least:

- `ok`
- gateway version
- platform
- host
- port
- `workspaceRoot`
- structured shell info
- trusted-local mode
- auto execute / insert / send defaults
- `maxToolRounds`

`GatewayRuntimeSnapshot` must include at least:

- optional validated `health`
- optional validated `catalog`
- optional `catalogSource`

## 4. Invariants

### 4.1 Health Is Structured, Not Loosely Typed

Shell diagnostics belong in the shared health contract as structured data. The browser runtime must not keep treating them as an unvalidated local string field.

### 4.2 Cached Bootstrap Is Catalog-Only

Cached bootstrap data may seed the catalog portion of the runtime snapshot, but it must not pretend to be live `/health` truth.

### 4.3 Failed Live Sync Must Not Masquerade As Live Catalog

If live `/tools` sync fails, the browser runtime must not keep calling the catalog live. It may keep a cached bootstrap for prompt warmup, but operator-facing state must preserve the distinction.

### 4.4 `/health` And `/tools` Stay Separately Canonical

The local runtime snapshot is an aggregation convenience. It does not authorize merging away the live route contracts or blurring which route is authoritative for which truth.

## 5. Non-Goals

This contract does not define:

- tool execution result shapes
- proposal workflow state
- ChatGPT page selectors or request-shape evidence
- future extension persistence format

## 6. Related Documents

- [catalog-contract.md](./catalog-contract.md)
- [execution-contract.md](./execution-contract.md)
- [../operations/gateway.md](../operations/gateway.md)
- [../prd.md](../prd.md)
