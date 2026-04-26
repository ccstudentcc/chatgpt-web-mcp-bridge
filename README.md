# ChatGPT Web MCP Bridge

A safe local tool bridge that lets ChatGPT Web request read-only project context through MCP-style JSON blocks.

> This is not an official ChatGPT MCP client. It is a local bridge for Windows + Chrome users who want a conservative, auditable workflow.

## Safety model

Default behavior is intentionally conservative:

- Only listens on `127.0.0.1`.
- Requires a pairing token for every endpoint except `/health`.
- Limits all file operations to `workspaceRoot`.
- Blocks `.env`, SSH keys, browser profile data, Git credentials, and other sensitive paths.
- Does not auto-execute detected tools by default.
- Does not auto-send tool results to ChatGPT.
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

Create `%USERPROFILE%\.chatgpt-web-mcp-bridge\config.json`:

```json
{
  "host": "127.0.0.1",
  "port": 8024,
  "workspaceRoot": "C:/Users/chenpeng/projects/current",
  "shell": "pwsh",
  "autoExecuteLowRisk": false,
  "autoInsertResult": true,
  "autoSendResult": false
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

The first startup creates a pairing token at:

```text
%USERPROFILE%\.chatgpt-web-mcp-bridge\token
```

## Install userscript

Build userscript:

```pwsh
pnpm dev:userscript
```

Install `apps/userscript/dist/chatgpt-mcp-bridge.user.js` in Tampermonkey.

Open ChatGPT Web. In the bridge panel:

- set the token from the local token file,
- adjust `Gateway base URL` if the gateway is not on the default `http://127.0.0.1:8024`,
- leave `Auto insert` on for the default flow, or turn it off if you want results to stay in `Insert result` / `Copy result` mode until you confirm them manually.

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
→ you click Run
→ gateway reads README.md under workspaceRoot
→ userscript inserts tool_result into the input box by default
→ you manually send it
```

If `Auto insert` is off, the panel keeps the result in `Insert result` / `Copy result` mode until you choose to insert it.

## Supported v0.1 tools

- `read_file`
- `list_directory`
- `search_files`
- `grep_files`

## Roadmap

- v0.2: Chrome Extension, `write_file_proposal`, diff confirmation UI
- v0.3: restricted `run_pwsh` with strong confirmation
- v0.4: real MCP stdio adapter with gateway permission mapping
