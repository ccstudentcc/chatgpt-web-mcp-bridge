# Phase 2.5 Extension Convergence

## 0. Document Status

- Status: active design
- Phase: `2.5`
- Scope: one explicit follow-on slice between the closed Phase 2 extraction program and later capability rollout
- Primary owners: `apps/extension` plus root task-control docs

This document defines the active Phase 2.5 design truth for the extension-side convergence slice. It is narrower than the full v0.9 target architecture and more durable than rollout-local task notes.

## 1. Purpose

Phase 2 closed the extension-only runtime path, but it intentionally stopped before three larger product-facing changes:

- replacing the hand-written extension shell with `WXT`
- promoting operator-facing extension UI onto `React` + `Tailwind CSS`
- restructuring extension runtime owners for a multi-surface product instead of a single in-page panel shell

Phase 2.5 exists to land those three changes as one deliberate slice, with one shared truth for ownership, state, surfaces, and verification.

## 2. Scope

### 2.1 In Scope

- Migrate the extension shell to `WXT` + Chrome Extension `MV3`
- Keep one ChatGPT-bound work surface as the primary operator surface
- Add `popup` and `options` as supported extension surfaces
- Rebuild operator-facing extension UI on `React` + `Tailwind CSS`
- Refactor extension-side runtime owners from the current Stage 19-21 layout into capability-domain owners that serve all supported surfaces cleanly
- Establish one explicit split between:
  - background-owned configuration truth
  - page-owned conversation runtime truth
- Keep the current live browser-to-gateway compatibility floor stable while the shell and owner migration happens:
  - `/health`
  - `/tools`
  - `/call-tool`
  - hidden request-layer injection
  - invalid-turn enforcement
  - startup/history rescan
  - execute / insert / send runtime semantics

### 2.2 Out Of Scope

- Broad gateway framework rewrites away from `Fastify`
- Replacing focused shared TypeScript packages with a second contract stack
- Multi-platform browser AI support
- Store, analytics, marketplace, or remote config work
- Full `reviewed` / `yolo` policy rollout as a separate product capability family
- Reopening the userscript as a live runtime shell

## 3. Surface Model

Detailed surface hierarchy and mode-governance truth for the current Phase 2.5 follow-on slice lives in [phase2.5-surface-hierarchy-and-mode-governance.md](./phase2.5-surface-hierarchy-and-mode-governance.md).

### 3.1 Primary Work Surfaces: Floating Panel And Chrome Side Panel

Phase 2.5 now treats the operator work surface as one product surface with two host containers:

- page-local floating panel on the ChatGPT page
- browser-native Chrome Side Panel

These two containers must expose the same feature set and workflow ordering. They differ only in layout density, host environment, and presentation rules.

Exactly one of them may be active at runtime for a given profile. The chosen host container is controlled by one persisted surface-mode setting.

The active work surface owns operator-facing access to:

- live conversation-scoped runtime status
- pending tool-turn interaction
- result delivery and recovery actions
- runtime-local diagnostics that depend on the active ChatGPT page
- a limited set of high-frequency global settings

The product must not drift into a split architecture where floating panel and side panel expose different workflow capabilities.

### 3.2 Secondary Surface: Popup

The popup is a lightweight launch surface.

It should expose only:

- current connection and bridge summary
- current persisted work-surface mode
- launch actions into the active work surface, ChatGPT tab, and options page
- a very small set of high-frequency global settings

It must not become the primary place for page-scoped execution, recovery, or diagnostics workflows.

### 3.3 Secondary Surface: Options

The options page is the full control console and the only durable settings home.

It should expose:

- the complete persisted settings set
- the canonical surface-mode selector
- health and connection overview
- materialized catalog overview
- diagnostics explanations and recent summarized logs
- entry paths into the active work surface

Options is the richest non-page surface, but it still does not replace the active work surface for live conversation-local execution and recovery.

## 4. State Ownership Model

### 4.1 Background-Owned Truth

The background service worker owns persisted extension configuration and cross-surface settings truth.

This includes:

- gateway base URL
- auto-execute / auto-insert / auto-send defaults that are meant to persist across surfaces
- continue-on-error preference
- request injection mode preference
- persisted work-surface mode preference
- any future extension-global operator preference that is not tied to one ChatGPT conversation

Popup and options should read and update this truth through explicit messaging contracts. The in-page runtime may cache or observe these values, but it does not own them.

### 4.2 Page-Owned Truth

The page runtime owns conversation-scoped live runtime truth.

This includes:

- current pending tool-turn state
- latest turn scan result
- current injection status
- current delivery and recovery state
- runtime-local diagnostics tied to the active ChatGPT DOM

Popup and options may observe summarized read models of this state, but they do not become its source of truth.

### 4.3 Gateway-Owned Truth That Must Stay External

Phase 2.5 does not change these ownership boundaries:

- materialized catalog truth stays on gateway `/tools`
- execution, policy, audit, and result-cache truth stay on gateway owners
- browser surfaces may summarize or cache these facts, but must not synthesize replacement truths locally

## 5. Capability-Domain Owner Model

Phase 2.5 intentionally refactors the extension runtime away from a mixed shell-plus-panel structure toward capability-domain owners.

### 5.1 Target Domains

#### `chatgpt-adapter`

Owns:

- ChatGPT page facts
- selectors, wrappers, and DOM access
- request-shape and page-structure facts

#### `request-injection`

Owns:

- catalog bootstrap and refresh consumption
- hidden request-layer injection payload creation
- visible/manual injection fallback semantics
- injection diagnostics state

This is the target successor to the current `injection-runtime`.

#### `turn-detection`

Owns:

- assistant turn normalization
- invalid-turn classification
- duplicate guard
- startup/history rescan semantics
- pending turn identity

This is the target successor to the current `turn-runtime`.

#### `result-delivery`

Owns:

- result formatting
- composer insertion
- auto-send and send confirmation
- delivery recovery and retry/copy fallback

#### `operator-workflows`

Owns:

- operator-facing derived state and summaries
- action availability and intent gating
- cross-surface command envelopes for operator actions
- diagnostics copy and workflow-oriented read models

This absorbs the long-term logic role of the current `operator-panel` owner, while leaving pure rendering to UI surfaces.

#### `settings`

Owns:

- persisted settings schema
- background-owned configuration storage interfaces
- cross-surface settings message contracts
- normalization and validation for extension-global preferences

#### `ui-surfaces`

Owns:

- `React` + `Tailwind CSS` apps for:
  - floating panel
  - side panel
  - popup
  - options
- shared design tokens, layout primitives, and presentational components

It does not own runtime truth or execution semantics.

#### `extension-shell`

Owns:

- `WXT` entrypoint bootstraps
- background lifecycle and message bridge
- content-script bootstrap
- main-world script injection
- surface mount boundaries

#### `main`

Owns composition only.

It wires domains together for each surface or runtime path, but it should not accumulate fresh business truth once the capability domains above are in place.

### 5.2 Explicit Split Between Owners And UI

Capability-domain owners remain plain TypeScript modules.

`React` and `Tailwind CSS` are for UI surfaces, not for re-homing domain logic into hooks or component trees. If a rule, state machine, or normalization path must be reused across in-page panel, popup, and options, it should live in a capability-domain owner first and only then be consumed by UI.

### 5.3 Rename And Split Guidance

The current extension layout is the migration baseline, not the long-term owner map.

Phase 2.5 is explicitly allowed to:

- rename `injection-runtime` to `request-injection`
- rename `turn-runtime` to `turn-detection`
- split `operator-panel` into `operator-workflows` plus `ui-surfaces`
- introduce `settings` as a first-class capability domain

## 6. Target Extension Structure

```text
apps/extension/
├─ entrypoints/
│  ├─ background.ts
│  ├─ chatgpt.content/
│  │  └─ index.ts
│  ├─ popup/
│  │  ├─ index.html
│  │  └─ main.tsx
│  ├─ options/
│  │  ├─ index.html
│  │  └─ main.tsx
│  ├─ sidepanel/
│  │  ├─ index.html
│  │  └─ main.tsx
│  └─ chatgpt-main-world.ts
├─ public/
├─ src/
│  ├─ extension-shell/
│  ├─ ui-surfaces/
│  ├─ chatgpt-adapter/
│  ├─ request-injection/
│  ├─ turn-detection/
│  ├─ result-delivery/
│  ├─ operator-workflows/
│  ├─ settings/
│  └─ main/
└─ wxt.config.ts
```

Key structural rules:

- `manifest.json` stops being a source file; `WXT` config plus entrypoints become the only extension-shell truth
- page-world request-hook installation moves to an unlisted script managed by `WXT`
- `popup`, `options`, and `sidepanel` are first-class entrypoints, not ad hoc HTML files outside the shell model
- `ui-surfaces` owns rendered UI; capability domains own reusable logic

## 7. Runtime Sequences

### 7.1 ChatGPT Page Startup

1. WXT content entrypoint starts on ChatGPT
2. content bootstrap injects the main-world request hook script
3. content bootstrap mounts the in-page panel surface
4. page runtime composes capability domains
5. page runtime reads persisted configuration snapshot from background
6. page runtime syncs gateway health and catalog
7. in-page panel renders live conversation state

### 7.2 Popup Startup

1. popup entrypoint loads shared design shell
2. popup requests background-owned settings snapshot
3. popup requests summarized active-tab bridge state when available
4. popup renders launch paths plus a minimal set of high-frequency settings

### 7.3 Chrome Side Panel Startup

1. side panel entrypoint loads the shared work-surface shell
2. side panel requests background-owned settings truth
3. side panel resolves the currently active tab context
4. if the active tab is ChatGPT, the shared work-surface app binds to that page runtime summary
5. if the active tab is not ChatGPT, the side panel renders an empty-state handoff with recent summary context

### 7.4 Options Startup

1. options entrypoint loads shared design shell
2. options reads background-owned settings truth
3. options requests gateway-facing read models and recent summarized diagnostics
4. options renders the full control console

### 7.5 Surface-Mode Update Flow

1. popup or options submits a persisted surface-mode mutation
2. background validates and persists the normalized mode
3. the currently active work-surface host is closed or hidden immediately
4. the newly selected work-surface host is opened when the host runtime allows it
5. if automatic side-panel opening is unavailable, the user sees an explicit handoff action rather than silently keeping both hosts visible

### 7.6 Settings Update Flow

1. popup, options, or in-page panel submits a settings mutation request
2. background validates and persists the change
3. background publishes the normalized settings snapshot
4. page runtime and other surfaces react to the same normalized truth

## 8. Migration And Deletion Rules

- Do not keep the hand-written shell and `WXT` shell in parallel once the active runtime path switches
- Do not keep a second UI truth outside `ui-surfaces` once the `React` + `Tailwind CSS` surfaces land
- Do not let popup or options become alternate execution architectures
- Do not let floating panel and side panel diverge into separate workflow products
- Do not allow floating panel and side panel to remain visible at the same time for one profile
- Do not move page facts, turn classification, injection logic, or delivery logic into background-only or UI-only files
- Delete or archive superseded shell scaffolding once the WXT path is verified

## 9. Validation And Stop Line

Phase 2.5 is complete only when all of the following are true:

- `WXT` is the only active extension shell build and dev path
- popup and options are real extension surfaces, not placeholders
- the active work surface is either floating panel or Chrome Side Panel, never both at once
- floating panel and side panel expose the same workflow capabilities
- configuration truth is background-owned and shared consistently across in-page panel, popup, and options
- page runtime truth remains page-owned and is only summarized elsewhere
- capability-domain owner boundaries are explicit in code and docs
- `React` + `Tailwind CSS` own operator-facing rendering, not runtime truth
- root and extension validation passes:
  - `pnpm --filter @cwmb/extension lint`
  - `pnpm --filter @cwmb/extension test`
  - `pnpm --filter @cwmb/extension build`
  - root `pnpm lint`
  - root `pnpm test`
  - root `pnpm build`
- real ChatGPT Web validation confirms:
  - the floating-panel path still works when selected
  - the Chrome Side Panel path works when selected
  - main-world request injection still works
  - `/health`, `/tools`, and `/call-tool` still work through the live browser path
  - popup reflects current bridge status
  - options acts as the full extension control console
