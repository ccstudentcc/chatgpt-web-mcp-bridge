# Extension Agent Notes

## Scope

- This file applies to `apps/extension`.

## Ownership

- `apps/extension/src/chatgpt-adapter/` is the canonical v0.9 code owner for ChatGPT Web page facts such as selectors, known conversation endpoints, turn-container fallbacks, send-button recognition, and ignorable status-text patterns.
- When current runtime code still needs those facts, adapt from this module outward; do not create a second source of truth under `apps/userscript`.

## Working Rule

- Keep `apps/extension` focused on target ownership boundaries and thin reusable surfaces; do not let it silently become a second full browser runtime before the active task docs authorize that extraction phase.
