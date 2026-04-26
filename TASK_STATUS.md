# Task Status

## Current Truth

- The repo already has a working scaffold for the v0.1 gateway, protocol package, and Tampermonkey userscript.
- `.gitattributes` now fixes repo text files to LF, and `.gitignore` now excludes `tmp/`.
- `search_files` is implemented with an `rg`-first path listing strategy and a Node fallback.
- `grep_files` now supports `glob`, context lines, secret redaction, and explicit `totalMatches` / `returnedMatches` / `truncated` metadata.
- Userscript tool calls now surface `UNAUTHORIZED` as a UI status and add an explicit truncation summary before inserting oversized tool results.

## Latest Verified Evidence

- `git ls-files --eol README.md package.json apps/gateway/src/index.ts apps/userscript/src/ui.ts docs/prd.md` showed `i/lf w/lf` before adding `.gitattributes`, and the new policy now preserves that line-ending choice.
- `pnpm --filter @cwmb/shared build` succeeded.
- `pnpm --filter @cwmb/protocol build` succeeded.
- `pnpm --filter @cwmb/gateway lint` succeeded.
- `pnpm --filter @cwmb/userscript lint` succeeded.
- `pnpm --filter @cwmb/gateway test -- src/tools/search-files.test.ts src/tools/grep-files.test.ts` succeeded with 3 passing tests.
- `pnpm --filter @cwmb/gateway build` succeeded.
- `pnpm --filter @cwmb/userscript build` succeeded after rerunning outside the sandbox because the sandbox blocked the `esbuild` child process with `spawn EPERM`.

## Next Step

- Continue the PRD sequence from the next v0.1 gap, likely `/tools`-driven userscript capability awareness or the remaining settings / status-panel polish.
- If app-level checks are run from a clean clone, build `@cwmb/shared` and `@cwmb/protocol` before validating `gateway` or `userscript`.

## Caveats

- App package imports currently resolve through workspace package `dist/` entrypoints, so clean-environment validation depends on building `packages/shared` and `packages/protocol` first.
