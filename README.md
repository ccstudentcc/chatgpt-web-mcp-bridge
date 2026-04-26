# ChatGPT Web MCP Bridge

A safe local tool bridge that lets ChatGPT Web request read-only project context through MCP-style JSON blocks.

> This is not an official ChatGPT MCP client. It is a local bridge for Windows + Chrome users who want a conservative, auditable workflow.

## Safety model

Default behavior is intentionally conservative:

- Only listens on `127.0.0.1`.
- Uses trusted local mode by default, so localhost requests do not need a pairing token.
- Limits all file operations to `workspaceRoot`.
- Blocks `.env`, SSH keys, browser profile data, Git credentials, and other sensitive paths.
- Auto-executes enabled v0.1 read-only tools after detection.
- Auto-inserts and auto-sends tool results to ChatGPT by default.
- Does not enable `run_pwsh` in v0.1.
- Does not write files in v0.1.

Do not point `workspaceRoot` at your whole user directory or disk root.

## Requirements

- Windows 11 + Chrome
- PowerShell Core (`pwsh`) recommended; Windows PowerShell fallback is detected
- Node.js 20+
- pnpm 9+
- Tampermonkey
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
  "workspaceRoot": "C:/Users/chenpeng/projects/current",
  "shell": "pwsh",
  "trustedLocalMode": true,
  "autoExecuteLowRisk": true,
  "autoInsertResult": true,
  "autoSendResult": true
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

## Install userscript

Build userscript:

```pwsh
pnpm dev:userscript
```

Install `apps/userscript/dist/chatgpt-mcp-bridge.user.js` in Tampermonkey.

Open ChatGPT Web. In the bridge panel:

- adjust `Gateway base URL` if the gateway is not on the default `http://127.0.0.1:8024`,
- verify `Auto execute`, `Auto insert`, and `Auto send` are all on for the fully automatic flow.

When you change the Gateway base URL in the panel, the userscript refreshes gateway status and `/tools` capabilities immediately.

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
→ userscript detects it
→ userscript auto-runs the enabled tool
→ gateway reads README.md under workspaceRoot
→ userscript inserts tool_result into the input box
→ userscript auto-sends it back to ChatGPT
```

If `Auto insert` is off, the panel keeps the result in `Insert result` / `Copy result` mode until you choose to insert it manually.

## Supported v0.1 tools

- `read_file`
- `list_directory`
- `search_files`
- `grep_files`

## Roadmap

- v0.2: Chrome Extension, `write_file_proposal`, diff confirmation UI
- v0.3: restricted `run_pwsh` with strong confirmation
- v0.4: real MCP stdio adapter with gateway permission mapping
