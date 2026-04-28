# ChatGPT Web MCP Bridge

A safe local tool bridge that lets ChatGPT Web request read-only project context through MCP-style JSON blocks.

> This is not an official ChatGPT MCP client. It is a local bridge for Windows + Chrome users who want a conservative, auditable workflow.

## Documentation map

- Active v0.9 mainline entrypoint: [`docs/v0.9-entrypoint.md`](docs/v0.9-entrypoint.md)
- Active v0.9 product boundary: [`docs/prd_vnext.md`](docs/prd_vnext.md)
- Active mainline task coordination: [`SPEC.md`](SPEC.md), [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md), [`TASK_STATUS.md`](TASK_STATUS.md)
- Closed v0.1 reference baseline: [`docs/prd.md`](docs/prd.md)
- Current operator troubleshooting: [`docs/operations/troubleshooting.md`](docs/operations/troubleshooting.md)
- Current v0.9 ChatGPT page-facts code owner: `apps/extension/src/chatgpt-adapter/`

## Safety model

Default behavior is intentionally conservative:

- Only injects on `https://chatgpt.com/*` and `https://chat.openai.com/*`.
- Only rewrites ChatGPT conversation requests, not arbitrary page traffic.
- Only listens on `127.0.0.1`.
- Rejects non-ChatGPT `Origin` headers at the gateway layer; Stage 19 extension proxy requests are only accepted when the extension asserts a real ChatGPT page origin.
- Uses trusted local mode by default, so localhost requests do not need a pairing token.
- Limits all file operations to `workspaceRoot`.
- Blocks `.env`, SSH keys, browser profile data, Git credentials, and other sensitive paths.
- Auto-executes enabled v0.1 read-only tools after detection.
- Auto-inserts and auto-sends tool results to ChatGPT by default.
- Keeps `write_file` disabled by default; enabling it requires `allowWrite=true`, and it still stays manual-only because it is high risk.
- Does not enable `run_pwsh` in v0.1.

Do not point `workspaceRoot` at your whole user directory or disk root.

## Requirements

- Windows 11 + Chrome
- PowerShell Core (`pwsh`) recommended; Windows PowerShell fallback is detected
- Node.js 20+
- pnpm 9+
- Chrome Extension developer mode for the primary Stage 19 runtime path
- Tampermonkey for the fallback userscript path until Stage 21
- `rg` recommended for faster search

## Install

```pwsh
pnpm install
pnpm build
```

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

Build the extension shell:

```pwsh
pnpm dev:extension
```

Then open `chrome://extensions`, enable Developer mode, choose `Load unpacked`, and select `apps/extension/dist`.

Expected Stage 19 smoke signals:

- the extension loads without manifest errors,
- the background service worker logs a lifecycle message,
- visiting ChatGPT Web mounts the bridge panel inside the content-script shadow host,
- request-hook diagnostics continue to report injection timing in the panel log.

## Install userscript fallback

Build userscript:

```pwsh
pnpm dev:userscript
```

Install `apps/userscript/dist/chatgpt-mcp-bridge.user.js` in Tampermonkey.

Open ChatGPT Web. In the bridge panel:

- adjust `Gateway base URL` if the gateway is not on the default `http://127.0.0.1:8024`,
- rely on automatic request-layer injection for the live MCP catalog by default,
- use `Insert MCP list` or `Copy MCP list` only as a diagnostic / fallback path if request injection drifts,
- use the collapsible inspector panel to review pending tools, result payloads, and the event log,
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
→ extension or userscript detects it
→ extension or userscript auto-runs the enabled tool
→ gateway reads README.md under workspaceRoot
→ extension or userscript inserts `tool_result` into the input box
→ extension or userscript auto-sends it back to ChatGPT
```

If `Auto insert` is off, the panel keeps the result in `Insert result` / `Copy result` mode until you choose to insert it manually.

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

## Supported v0.1 tools

`mcp_list` returns the same live gateway catalog that ChatGPT sees, including `mcp_list` itself, so total/enabled counts stay aligned with `/tools` and the injected prompt.

Default enabled:
- `mcp_list`
- `read_file` (blocks high-confidence secrets, redacts lower-confidence assignment-style placeholders)
- `list_directory`
- `search_files`
- `grep_files` (literal `query` or literal `patterns[]` by default, optional explicit `regex` mode, same sensitive-content policy as `read_file`)

Optional gated:
- `write_file` (`allowWrite=true`, high risk, manual-only)

## Historical Roadmap

The bullets below are the older v0.1-era incremental roadmap and are kept only as historical context. The active route now lives in [`docs/v0.9-entrypoint.md`](docs/v0.9-entrypoint.md), [`docs/prd_vnext.md`](docs/prd_vnext.md), and the root task-control docs.

- v0.2: Chrome Extension, `write_file_proposal`, diff confirmation UI
- v0.3: restricted `run_pwsh` with strong confirmation
- v0.4: real MCP stdio adapter with gateway permission mapping
