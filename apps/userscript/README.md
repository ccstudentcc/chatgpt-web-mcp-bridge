# Legacy Userscript Archive

`apps/userscript/` is archived as of April 28, 2026 during Stage 21 `remove-compat-layers`.

- The active browser runtime now lives entirely under `apps/extension/`.
- This directory is no longer a pnpm workspace member and is not a supported build target.
- Legacy Stage 20 source, scripts, and artifacts are preserved under `apps/userscript/legacy/` for runtime-reference and evidence lookup only.
- Do not add new behavior here. Land browser-runtime changes in `apps/extension/` instead.
