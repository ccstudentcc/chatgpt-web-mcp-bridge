# Example MCP tool calls

## Read a file

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

## List directory

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
````

## Search file paths

````markdown
```mcp
{
  "tool": "search_files",
  "args": {
    "query": "package",
    "maxResults": 50
  }
}
```
````

## Grep text

````markdown
```mcp
{
  "tool": "grep_files",
  "args": {
    "query": "workspaceRoot",
    "glob": "**/*.{ts,md,json}",
    "maxResults": 100,
    "caseSensitive": false
  }
}
```
````
