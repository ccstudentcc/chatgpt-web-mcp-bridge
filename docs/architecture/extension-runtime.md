# Extension Runtime

## 0. Document Status

- Status: draft v1
- Owner: `apps/extension`
- Scope: ChatGPT-page runtime responsibilities, boundaries, and local sequencing

This document expands the extension-owned half of the target architecture. It does not define gateway execution semantics.

## 1. Purpose

The extension runtime exists to own everything that depends on real ChatGPT page behavior:

- hidden request-layer injection
- assistant turn detection
- invalid-turn handling
- startup/history rescan
- duplicate guard
- result delivery
- operator-facing runtime state

The extension runtime is not a place for tool execution, proposal apply, shell execution, or external MCP lifecycle.

## 2. Module Layout

```text
apps/extension/src/
├─ extension-shell/
├─ chatgpt-adapter/
├─ injection-runtime/
├─ turn-runtime/
├─ result-delivery/
├─ operator-panel/
└─ main/
```

Current Stage 19-21 runtime state:

- `apps/extension/src/main/extension-runtime.ts` now owns the shared browser-runtime composition root used by the real extension shell and the extension-owned runtime helpers under `src/main/*`.
- `apps/extension/src/extension-shell/*` now owns the Chrome-extension host layer: manifest-driven entrypoints, background lifecycle ping, gateway messaging bridge, main-world request hook, content-script bootstrap, and panel mount isolation.
- Stage 21 archives the former userscript bootstrap under `apps/userscript/legacy/`; the active browser runtime path is now extension-only.
- Local extension and root verification are green for `pnpm --filter @cwmb/extension lint`, `test`, and `build` plus root `pnpm lint`, `pnpm test`, and `pnpm build`; unpacked-Chrome and real ChatGPT Web extension-path validation remain the open Stage 21 close-out gate.

## 3. Module Boundaries

### 3.1 `chatgpt-adapter`

Owns:

- page facts
- DOM selectors and wrappers
- composer state
- assistant/user turn snapshots
- observer hooks and page diagnostics
- the canonical v0.9 code module for ChatGPT Web page facts, currently seeded at `apps/extension/src/chatgpt-adapter/chatgpt-runtime-facts.ts`
- newly discovered ChatGPT-page helpers such as selector refinements, placeholder recognition, turn-id extraction, and other runtime normalization facts before they are consumed elsewhere

Does not own:

- tool execution decisions
- gateway transport logic
- result semantics

Minimum public surface:

- get composer state
- list assistant turns
- observe turn stream
- expose page diagnostics facts
- expose shared page-fact constants/helpers without forcing compat consumers to redefine them

Rule:

- if a fact is primarily about how ChatGPT Web renders, labels, structures, or identifies page elements, add it here first and let downstream modules consume it
- `turn-runtime`, `injection-runtime`, `result-delivery`, and current userscript compat code should not each grow their own copies of page-fact logic

### 3.2 `injection-runtime`

Owns:

- catalog bootstrap consumption
- hidden request-layer injection payload generation
- fallback manual/visible injection support
- injection success/failure diagnostics

Does not own:

- assistant turn parsing
- duplicate guard
- tool execution

Invariants:

- hidden injection is the primary path
- visible/manual injection is recovery only
- current live catalog truth remains grounded in `/tools` until an approved migration exists

Current Phase 1 seed:

- `apps/extension/src/injection-runtime/request-injection-state.ts` now owns the pure request-injection mode/status helper semantics used by current userscript compat state and request-hook diagnostics
- `apps/extension/src/injection-runtime/catalog.ts` now owns hidden-versus-visible catalog prompt construction, the shared tool-guidance text consumed by both prompt wrappers, and bootstrap/live prompt-sync copy
- `apps/extension/src/injection-runtime/catalog-cache.ts` now owns browser-local catalog bootstrap cache read/write semantics
- `apps/extension/src/injection-runtime/request-body-injection.ts` now owns request-payload mutation for hidden prompt injection, while current userscript `request-hook.ts` remains the runtime shell that installs page hooks and forwards diagnostics

### 3.3 `turn-runtime`

Owns:

- normalized assistant turn extraction
- invalid-turn classification
- duplicate guard
- latest-open-turn tracking
- startup/history rescan
- `ExecuteRequest` construction

Does not own:

- DOM insertion
- tool execution
- final allow/deny decisions

Invariants:

- only the extension decides whether a ChatGPT assistant turn is a candidate tool turn
- invalid-turn blocking happens before pending execution
- fallback paths must reuse the same normalized turn model

Current Phase 1 seed:

- `apps/extension/src/turn-runtime/*` now owns the pure invalid-turn state, pending-selection identity, and auto-round guard helper semantics used by current userscript compat code

### 3.4 `result-delivery`

Owns:

- formatting `ResultEnvelope` into bridge-deliverable content
- composer insertion
- auto-send behavior
- copy and retry fallback paths

Does not own:

- gateway-side result generation
- policy interpretation beyond delivery needs
- execution history truth

Invariants:

- result delivery does not rewrite execution meaning
- insertion failure must not discard a valid result
- auto-send is local runtime behavior, not gateway policy

### 3.5 `operator-panel`

Owns:

- runtime snapshot display
- operator intents such as manual run, retry, and approve
- diagnostics copy entrypoints
- conversation-scoped execution-profile control

Current Phase 2 progress:

- `apps/extension/src/operator-panel/runtime-snapshot.ts` now owns the pure browser-side runtime-snapshot helper semantics used by current userscript compat state
- `apps/extension/src/operator-panel/capabilities.ts` now owns pending-tool capability assessment plus manual-versus-auto action gating for the current operator panel
- `apps/extension/src/operator-panel/panel-state.ts` now owns operator-facing runtime stat assembly, injection diagnostics summary copy, action visibility, and collapsed-toggle availability while current userscript `ui.ts` remains the DOM/render shell
- Stage 19 keeps those operator-panel owner semantics intact while letting the extension content script mount the rendered panel inside an isolated shadow-root host.

Does not own:

- a second execution state machine
- direct raw tool execution
- catalog materialization

## 4. State Ownership

Extension-owned runtime state includes:

- conversation execution profile
- latest open turn
- duplicate guard state
- injection status
- result-delivery status

State rules:

- conversation-scoped execution profile belongs to the extension because it is ChatGPT-conversation-local runtime state
- the extension must send that profile to the gateway as request-scoped policy input
- the gateway may constrain the requested profile through workspace hard policy, but it does not own the profile as browser conversation state

## 5. Local Runtime Sequences

### 5.1 Hidden Injection Main Path

1. fetch or hydrate materialized catalog
2. build hidden payload
3. attach payload to outgoing ChatGPT request
4. record injection diagnostics

### 5.2 Turn Detection Path

1. observe assistant output
2. normalize candidate tool calls
3. classify valid vs invalid vs incomplete vs recoverable-noise turn
4. apply duplicate guard
5. emit `ExecuteRequest`

### 5.3 Delivery Path

1. receive `ResultEnvelope`
2. format bridge result payload
3. insert into composer
4. auto-send when enabled
5. expose retry/copy when delivery fails

## 6. Fallback And Recovery

The extension runtime must support recovery for:

- hidden injection failure
- invalid or mixed MCP turn output
- startup refresh after a page reload
- result insertion failure
- gateway disconnect

Recovery rules:

- recovery must not create a second execution architecture
- manual actions still return through the same runtime contract
- duplicate guard, policy, and audit assumptions must remain intact

## 7. Forbidden Couplings

The extension runtime must not:

- implement builtin tool logic
- apply proposals directly
- run shell commands
- manage external MCP server lifecycle
- fabricate a second local catalog truth
- let the panel bypass runtime orchestration

## 8. Related Documents

- [v0.9-target-architecture.md](./v0.9-target-architecture.md)
- [migration-boundaries.md](./migration-boundaries.md)
- [../protocols/catalog-contract.md](../protocols/catalog-contract.md)
- [../protocols/execution-contract.md](../protocols/execution-contract.md)
- [../protocols/result-envelope.md](../protocols/result-envelope.md)
- [../protocols/policy-decision.md](../protocols/policy-decision.md)
