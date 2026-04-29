# ChatGPT Web MCP Bridge

A Chrome Extension plus local gateway that lets ChatGPT Web read local workspace context, call guarded local tools, and return results back into the active conversation.

> This is not an official ChatGPT MCP client. It is a local bridge for ChatGPT Web users who want a conservative, auditable workflow.

## Documentation map

- Active v0.9 mainline entrypoint: [`docs/v0.9-entrypoint.md`](docs/v0.9-entrypoint.md)
- Active v0.9 product boundary: [`docs/prd_vnext.md`](docs/prd_vnext.md)
- Active mainline task coordination: [`SPEC.md`](SPEC.md), [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md), [`TASK_STATUS.md`](TASK_STATUS.md)
- Closed v0.1 reference baseline: [`docs/prd.md`](docs/prd.md)
- Current operator troubleshooting: [`docs/operations/troubleshooting.md`](docs/operations/troubleshooting.md)
- Current v0.9 ChatGPT page-facts code owner: `apps/extension/src/chatgpt-adapter/`

## Current repo status

- v0.1 stop line is closed; `docs/prd.md` is the proven reference baseline, not the active target.
- v0.9 is the active mainline.
- Phase 2 and Phase 2.5 are complete.
- There is currently no active follow-on slice; activate the next one through the root task-control docs before reopening implementation scope.

## What ships today

- Chrome Extension `MV3` runtime built with `WXT`
- local gateway with the live route set `/health`, `/tools`, and `/call-tool`
- ChatGPT-only request injection, MCP turn detection, result insertion, and auto-send flow
- one shared primary work surface rendered either as the in-page floating panel or the Chrome Side Panel
- launcher-first `popup` plus full-console `options`
- background-owned extension settings and page-owned conversation runtime state
- conservative builtin-first tool execution with diagnostics, audit, and path-policy enforcement

## Safety model

Default behavior is intentionally conservative:

- Only injects on `https://chatgpt.com/*` and `https://chat.openai.com/*`.
- Only rewrites ChatGPT conversation requests, not arbitrary page traffic.
- Only listens on `127.0.0.1`.
- Rejects non-ChatGPT `Origin` headers at the gateway layer; Stage 19 extension proxy requests are only accepted when the extension asserts a real ChatGPT page origin.
- Uses trusted local mode by default, so localhost requests do not need a pairing token.
- Limits all file operations to `workspaceRoot`.
- Blocks `.env`, SSH keys, browser profile data, Git credentials, and other sensitive paths.
- Auto-executes enabled low-risk tools after detection.
- Auto-inserts and auto-sends tool results to ChatGPT by default.
- Keeps `write_file` disabled by default; enabling it requires `allowWrite=true`, and it still stays manual-only because it is high risk.
- Keeps `run_pwsh` disabled by default unless `allowPwsh=true`.

Do not point `workspaceRoot` at your whole user directory or disk root.

## Requirements

- Windows 11 + Chrome
- PowerShell Core (`pwsh`) recommended; Windows PowerShell fallback is detected
- Node.js 20+
- pnpm 9+
- Chrome Extension developer mode for the current extension-only runtime path
- `rg` recommended for faster search

## Install

```pwsh
pnpm install
```

Useful entrypoints:

```pwsh
pnpm dev
pnpm dev:gateway
pnpm dev:extension
pnpm build
pnpm test
pnpm lint
```

- `pnpm dev` starts both the gateway and the extension dev flow
- `pnpm dev:gateway` starts only the local gateway
- `pnpm dev:extension` starts the extension-side WXT flow
- `pnpm build` emits the current production build artifacts for the whole workspace

## Configure workspaceRoot

On first gateway startup, `%USERPROFILE%\.chatgpt-web-mcp-bridge\config.json` is created automatically. If it is missing or leaves `workspaceRoot` empty, the gateway uses the current startup directory as the initial `workspaceRoot`.

You can still edit the file explicitly:

```json
{
  "host": "127.0.0.1",
  "port": 8024,
  "workspaceRoot": "C:/Users/your-name/projects/current",
  "shell": "pwsh",
  "trustedLocalMode": true,
  "allowWrite": false,
  "autoExecuteLowRisk": true,
  "autoInsertResult": true,
  "autoSendResult": true,
  "maxToolRounds": 3
}
```

## Start local gateway

```pwsh
pnpm dev:gateway
```

Check health:

```pwsh
Invoke-RestMethod http://127.0.0.1:8024/health
```

If you later want explicit pairing-token auth again, set `"trustedLocalMode": false` and restart the gateway.

## Load the extension

Build or refresh the extension output:

```pwsh
pnpm dev:extension
# or
pnpm --filter @cwmb/extension build
```

Then open `chrome://extensions`, enable Developer mode, choose `Load unpacked`, and select:

```text
apps/extension/.output/chrome-mv3
```

Do not use `apps/extension/dist` as the unpacked extension root. The current WXT-owned extension output lives under `.output/chrome-mv3`.

Expected extension-runtime smoke signals:

- the extension loads without manifest errors,
- the background service worker logs a lifecycle message,
- visiting ChatGPT Web mounts the floating panel when `floating_panel` mode is selected,
- the Chrome Side Panel opens as the primary work surface when `side_panel` mode is selected,
- request-hook diagnostics continue to report injection timing in the work-surface diagnostics area.

The former userscript implementation is archived under [`apps/userscript/README.md`](apps/userscript/README.md) as a Stage 21 legacy reference. It is no longer a workspace app or a supported runtime path.

Current surface hierarchy after the closed Phase 2.5 pack:

- ChatGPT in-page floating panel or Chrome Side Panel is the primary work surface
- popup is a lightweight launcher and quick-settings companion
- options is the full control console
- only one work-surface host is allowed at runtime for one profile

Open ChatGPT Web. In the work surface:

- adjust `Gateway base URL` if the gateway is not on the default `http://127.0.0.1:8024`,
- rely on automatic request-layer injection for the live MCP catalog by default,
- use `Insert MCP list` or `Copy MCP list` only as a diagnostic / fallback path if request injection drifts,
- use the collapsed diagnostics/log region to review pending tools, result payloads, and runtime state,
- verify `Auto execute`, `Auto insert`, and `Auto send` are all on for the fully automatic flow,
- leave `Continue on error` off if you want fail-stop batch behavior, or turn it on to keep executing later tools after one batch item fails.

When you change the Gateway base URL in the panel, the active browser runtime refreshes gateway status and `/tools` capabilities immediately.

## Try your first tool call

Ask ChatGPT to output:

````markdown
```mcp
{
  "tool": "read_file",
  "args": {
    "path": "README.md"
  }
}
```
````

Expected flow:

```text
ChatGPT outputs mcp block
→ extension detects it
→ extension auto-runs the enabled tool
→ gateway reads README.md under workspaceRoot
→ extension inserts `tool_result` into the input box
→ extension auto-sends it back to ChatGPT
```

If `Auto insert` is off, the panel keeps the result in `Insert result` / `Copy result` mode until you choose to insert it manually.

## Current live surfaces

- Work surface:
  - ChatGPT floating panel
  - Chrome Side Panel
- Secondary extension surfaces:
  - `popup` for launch actions, bridge summary, and a very small quick-setting set
  - `options` for full settings, connection state, automation policy, interface preferences, and diagnostics overview

## Current live gateway contracts

- `/health`: gateway reachability, config-derived runtime status, and operator-visible health summary
- `/tools`: canonical live tool catalog
- `/call-tool`: canonical live execution route

If `/health` is healthy but browser behavior is wrong, the next place to inspect is usually request injection, turn detection, or result delivery rather than the gateway itself.

## Optional gated write tool

For local self-hosting workflows, the gateway also ships an optional high-risk `write_file` tool.

- Keep `"allowWrite": false` unless you explicitly want local file writes.
- `write_file` stays disabled until you set `"allowWrite": true` and restart the gateway.
- Even when enabled, `write_file` remains manual-only on the ChatGPT side because it is high risk and requires confirmation.
- `write_file` still uses `workspaceRoot` and the same blocked-path policy, so `.env`, key material, and paths outside the workspace are rejected.

Example:

````markdown
```mcp
{
  "tool": "write_file",
  "args": {
    "path": "docs/example.md",
    "content": "# Updated content",
    "mode": "replace"
  }
}
```
````

## Batch tool calls

One assistant reply can contain multiple `mcp` blocks. The active browser runtime will:

```text
detect the blocks in order
→ execute them serially
→ either stop on the first failure or continue, depending on `Continue on error`
→ insert one unified tool_result_batch back into ChatGPT
```

Example:

````markdown
```mcp
{
  "tool": "list_directory",
  "args": {
    "path": ".",
    "maxDepth": 2
  }
}
```

```mcp
{
  "tool": "read_file",
  "args": {
    "path": "README.md"
  }
}
```
````

Observed outcomes from the current implementation:

- success batch:
  `completed: 3`, `failed: 0`, `skipped: 0`, `stoppedOnFailure: false`
- stopped batch after a blocked path:
  `completed: 1`, `failed: 1`, `skipped: 1`, `stoppedOnFailure: true`
- continue-on-error batch:
  `completed: 2`, `failed: 1`, `skipped: 0`, `stoppedOnFailure: false`
- verified blocked-path example:
  trying to read `.env` returns `BLOCKED_PATH`
- verified post-failure behavior:
  later blocks in the same assistant reply return `SKIPPED_AFTER_BATCH_FAILURE`

## Error-path checks

Useful manual acceptance checks:

- `read_file` on `.env` should fail with `BLOCKED_PATH`.
- `read_file` on `../README.md` should fail with `PATH_OUTSIDE_WORKSPACE`.
- `run_pwsh` should fail with `PWSH_DISABLED` or `TOOL_DISABLED` in v0.1.
- In a multi-block batch, once one item fails, the remaining items should come back as `skipped`, with reason `SKIPPED_AFTER_BATCH_FAILURE`.

## Current live tools

`mcp_list` returns the same live gateway catalog that ChatGPT sees, including `mcp_list` itself, so total/enabled counts stay aligned with `/tools` and the injected prompt.

Enabled by default:
- `mcp_list`
- `read_file` (blocks high-confidence secrets, redacts lower-confidence assignment-style placeholders)
- `list_directory`
- `search_files`
- `grep_files` (literal `query` or literal `patterns[]` by default, optional explicit `regex` mode, same sensitive-content policy as `read_file`)

Optional but shipped:
- `write_file` (`allowWrite=true`, high risk, manual-only)

Present as disabled placeholders or power tools:
- `write_file_proposal` (currently disabled placeholder for a later proposal flow)
- `run_pwsh` (`allowPwsh=true`, high risk, confirmation-oriented, not part of the default conservative path)

## Historical Roadmap

The bullets below are older roadmap notes kept only as historical context. The current route now lives in [`docs/v0.9-entrypoint.md`](docs/v0.9-entrypoint.md), [`docs/prd_vnext.md`](docs/prd_vnext.md), and the root task-control docs.

- v0.2: Chrome Extension, `write_file_proposal`, diff confirmation UI
- v0.3: restricted `run_pwsh` with strong confirmation
- v0.4: real MCP stdio adapter with gateway permission mapping

## Related Links

- [Linuxdo](https://linux.do/)
