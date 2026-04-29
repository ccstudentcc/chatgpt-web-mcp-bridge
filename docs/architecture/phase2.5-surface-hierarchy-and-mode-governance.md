# Phase 2.5 Surface Hierarchy And Mode Governance

## 0. Document Status

- Status: closed design
- Phase: `2.5`
- Scope: closed follow-on surface redesign slice inside the broader Phase 2.5 convergence program
- Primary owners: `apps/extension/src/ui-surfaces/*`, `apps/extension/src/settings/*`, `apps/extension/src/extension-shell/*`, and root task-control docs

This document records the product and runtime truth for the closed Phase 2.5 surface redesign slice. It exists because the first Phase 2.5 landing established the WXT shell, popup/options entrypoints, and background-owned settings, but it did not yet establish a clean hierarchy across popup, floating panel, Chrome Side Panel, and options.

## 1. Problem Statement

At the start of this slice, the extension surface pack still had four structural problems:

- popup is carrying too much product weight for a companion launcher
- options does not yet read as a clearly layered control console
- floating panel has no browser-native side-panel peer with matching behavior
- runtime surface exclusivity is not explicit enough; the product needs exactly one active work surface at a time

This slice corrects those issues without reopening gateway product scope or turning popup/options into alternative execution architectures.

## 2. Goals

- Establish one explicit hierarchy across popup, work surface, and options
- Introduce Chrome Side Panel as a first-class host container for the same operator workflows as the floating panel
- Persist one work-surface mode setting that chooses floating panel or side panel
- Guarantee that floating panel and side panel never appear at the same time for one profile
- Make the options page the full control console with clear left-nav information architecture
- Keep popup small, fast, and intentionally incomplete
- Preserve the current browser-to-gateway compatibility floor while changing surface structure

## 3. Non-Goals

- Replacing the page-owned runtime with a background-owned execution architecture
- Giving popup full parity with the work surface
- Making options the live conversation execution surface
- Introducing a second settings truth outside the existing background-owned snapshot
- Reopening multi-platform support, session management, reviewed/yolo rollout, or gateway capability expansion

## 4. Product Surface Hierarchy

### 4.1 Popup

Popup is a launcher and status companion.

It may contain only:

- current work-surface mode
- current bridge / connection summary
- launch actions:
  - open the currently selected work surface
  - open or focus ChatGPT
  - open options
- a maximum of four writable high-frequency settings:
  - work-surface mode
  - gateway base URL
  - pairing token
  - auto execute

Popup must not contain:

- live pending-turn workflow controls
- detailed diagnostics logs
- bulk configuration editing
- an alternate execution path that bypasses the selected work surface

### 4.2 Work Surface

The work surface is the primary operator surface. It exists in two host containers:

- floating panel
- Chrome Side Panel

These two hosts must expose the same feature set, workflow order, and settings affordances. They differ only in presentation density and host integration.

The work surface is responsible for:

- live conversation status
- pending tool-turn actions
- result delivery and recovery
- runtime detail summaries
- a small secondary settings region
- collapsed diagnostics/log access

### 4.3 Options

Options is the full control console.

It is the canonical place for:

- complete settings editing
- mode selection and surface explanations
- connection and automation policies
- interface preferences
- diagnostics overview and operator-facing explanations

Options may launch the currently selected work surface, but it does not become the work surface itself.
Options is a real browser-tab settings surface, not a popup-sized shell.

## 5. Work-Surface Mode Governance

### 5.1 Persisted Mode Truth

The extension owns one persisted setting:

- `workSurfaceMode = "floating_panel" | "side_panel"`

This value lives in the existing background-owned settings truth and must be readable from popup, options, background, and the page runtime.

### 5.2 Allowed Editors

The work-surface mode may be edited only from:

- popup
- options

The work surface itself must not expose a mode switcher. This keeps the hierarchy stable and avoids turning runtime UI into a control-plane loop.

### 5.3 Immediate Switch Rule

When the user changes `workSurfaceMode`:

1. the currently active host surface must close or hide immediately
2. the newly selected host surface must become the only allowed active host
3. if Chrome blocks automatic side-panel opening in the current moment, the product must show a direct follow-up action rather than silently leaving both hosts visible

The system must prefer consistency over convenience. Temporary "both are visible" states are not allowed.

## 6. Context Binding Rules

### 6.1 ChatGPT Tab Following

The work surface always follows the currently active ChatGPT tab.

- if the current active tab is ChatGPT, the work surface binds to that tab
- if the user switches between multiple ChatGPT tabs, the bound work surface context switches immediately
- if the current active tab is not ChatGPT, the work surface must not expose live conversation actions against a stale hidden tab

### 6.2 Non-ChatGPT Empty State

The Chrome Side Panel may still open when the active tab is not ChatGPT, but it shows an empty-state handoff rather than a fake live control panel.

That empty state should contain:

- current selected work-surface mode
- latest known connection summary
- primary action: focus the most recent ChatGPT tab
- secondary action: open a new ChatGPT tab

### 6.3 Floating Panel Presence

The floating panel exists only on ChatGPT pages. It is page-local by definition.

If the selected mode is side panel, the page must not mount the floating panel UI.

## 7. Information Architecture

### 7.1 Popup IA

Popup uses a strict three-layer hierarchy:

1. status strip
   - current mode
   - connection / bridge summary
2. launch cluster
   - open work surface
   - focus/open ChatGPT
   - open options
3. quick settings cluster
   - work-surface mode
   - gateway base URL
   - pairing token
   - auto execute

Popup must feel intentionally incomplete. It is a fast handoff surface, not a mini console.

### 7.2 Work-Surface IA

Floating panel and side panel share the same structural order:

1. top status bar
   - bound tab identity
   - connection summary
   - selected mode badge
   - recent error summary
2. main action region
   - pending tool work
   - execute / insert / send / continue / retry
   - recovery actions
3. runtime detail region
   - request injection status
   - turn state
   - latest result summary
   - catalog provenance
4. secondary settings region
   - a small set of globally persisted settings
   - explicit link to options for full editing
5. diagnostics and logs region
   - collapsed by default
   - expandable in place

The work surface is workflow-first, not settings-first and not log-first.

### 7.3 Options IA

Options uses a left navigation plus right content-console layout.

Recommended navigation groups:

- `General`
- `Connection`
- `Automation`
- `Interface`
- `Diagnostics`

Default landing group: `General`

`General` should lead with:

- current work-surface mode
- surface hierarchy explanation
- launch actions into the selected work surface and ChatGPT

## 8. Host-Specific Presentation Rules

### 8.1 Floating Panel

- default position: right-middle of the ChatGPT page
- draggable
- collapsible
- medium default size
- must be able to complete the full work-surface workflow without expanding into a second page

### 8.2 Chrome Side Panel

- browser-native Chrome Side Panel host
- not collapsible
- same features as the floating panel
- more relaxed spacing and clearer sectional separation than the floating panel

## 9. Visual Direction

The redesign should use a desktop workbench visual language rather than a soft generic SaaS look.

Direction:

- higher contrast for the primary action region
- clearly separated section bands
- restrained but visible status color semantics
- settings visually one level below main actions
- diagnostics visually one level below settings unless error severity escalates

Recommended implementation direction from the current design-system search:

- take the `data-dense dashboard` strengths for hierarchy and operational clarity
- reject the landing-page journey pattern as not relevant to extension product surfaces
- keep light mode as the default product truth for the console surfaces unless a later slice deliberately adds theme support

Typography guidance:

- use a deliberate product pair such as a sans family for content plus a mono family for status and diagnostics labels
- avoid default all-Inter flatness across every surface

Color guidance:

- status and navigation should stay cool and restrained
- primary workflow actions should carry the strongest contrast
- destructive or broken states should surface as local severity accents, not as a whole-page red wash

## 10. State And Ownership Consequences

- `settings/*` must grow to include the persisted work-surface mode field
- `extension-shell/*` must own side-panel launch/close orchestration and floating-panel exclusivity enforcement
- `ui-surfaces/*` must host one shared work-surface app that can render into floating panel or side panel
- `main/*` must stop treating the floating panel as the only host container for operator workflows
- popup and options must read and write the same normalized background-owned settings snapshot

## 11. Validation Requirements

This slice is not complete until all of the following are verified:

- popup only exposes the allowed launcher and quick-setting set
- options is visibly hierarchical and functions as the full control console
- floating panel and side panel expose the same feature set
- selecting one host mode guarantees that the other host is not visible
- switching modes from popup or options takes effect immediately
- the active work surface follows the currently active ChatGPT tab
- side-panel empty state behaves correctly outside ChatGPT
- extension checks pass:
  - `pnpm --filter @cwmb/extension lint`
  - `pnpm --filter @cwmb/extension test`
  - `pnpm --filter @cwmb/extension build`
- root checks pass:
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- real ChatGPT Web validation confirms:
  - floating-panel mode works end-to-end
  - side-panel mode works end-to-end
  - mode switching is immediate and exclusive
  - popup launches the selected work surface correctly
  - options can launch and fully configure the selected work surface correctly
