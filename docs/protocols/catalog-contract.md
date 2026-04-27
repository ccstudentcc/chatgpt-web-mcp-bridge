# Catalog Contract

## 0. Document Status

- Status: draft v1
- Owner: gateway `tool-registry`
- Used by: extension injection runtime, operator panel, future gateway diagnostics and contract tests

This document defines the materialized tool catalog contract between the gateway and the browser runtime.

## 1. Purpose

The catalog contract exists to provide one shared truth for:

- hidden prompt injection
- operator-facing capability display
- runtime capability gating
- future contract tests

The catalog contract is not the raw tool registry. It is the materialized, model-facing, policy-aware view of currently available tools.

## 2. Current Canonical Reality

At the current repo stage, the live catalog truth is served through `/tools`.

Until product truth and task-control docs explicitly approve a dual-route migration, `/tools` remains the canonical live catalog contract. A future logical name such as `/catalog` may exist later, but it must not silently demote `/tools` while the current runtime still depends on it.

Current implementation note:

- The gateway already serves a materialized `CatalogContract` on `/tools`.
- The userscript live client now validates that full contract before consuming `tools[]`, instead of silently treating malformed payloads as an empty catalog.
- The userscript cache/bootstrap/runtime state now retain that full catalog contract, so diagnostics can reuse `catalogVersion` and `workspaceRoot` without inventing a second metadata channel beside `tools[]`.
- The userscript runtime now also tracks whether the visible catalog is live or cache-derived, so operator diagnostics do not confuse bootstrap state with a successful live `/tools` sync.

## 3. Minimum Contract Surface

The materialized catalog response must include at least:

- `catalogVersion`
- workspace summary
- generated timestamp
- a list of materialized tool descriptors

Each materialized tool descriptor must include at least:

- stable tool name
- display name
- description
- source: builtin or external
- risk classification
- mode-aware availability
- confirmation requirement
- argument schema reference or equivalent stable schema identifier
- example calls or example arguments

## 4. Invariants

### 4.1 Single Materialized Truth

The extension must not synthesize a second local catalog truth. It may cache or display the catalog, but it must not invent callable state or mode availability on its own.

### 4.2 Current Runtime Must Stay Aligned

At the current v0.1 stage, the following must remain aligned:

- `/tools`
- hidden request-layer injected capability prompt
- `mcp_list`
- manual fallback catalog display

If those diverge, the system will teach the model one thing and enforce another.

### 4.3 External Tools Must Arrive Normalized

External tools must be namespace-normalized before they appear in the catalog. The browser runtime must not receive raw external tool names and infer namespace rules locally.

### 4.4 Availability Is Materialized, Not Guessed

Mode-aware callable state belongs in the materialized catalog. The extension should consume it, not reconstruct it from unrelated flags.

## 5. Non-Goals

This contract does not define:

- raw gateway registry internals
- how tools are executed
- detailed result shapes
- ChatGPT page-specific injection mechanics

## 6. Compatibility Rules

- `/tools` remains canonical until an approved migration plan exists
- any future logical renaming must preserve dual-route compatibility during migration
- contract expansion may add fields, but must not silently remove currently required fields used by hidden injection or runtime gating

## 7. Related Documents

- [../architecture/v0.9-target-architecture.md](../architecture/v0.9-target-architecture.md)
- [execution-contract.md](./execution-contract.md)
- [../prd.md](../prd.md)
