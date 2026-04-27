import type { ToolDescriptor } from '@cwmb/protocol';

export interface ToolCatalogSummary {
  total: number;
  enabled: number;
  disabled: number;
}

export function summarizeToolCatalog(tools: ToolDescriptor[]): ToolCatalogSummary {
  const enabled = tools.filter((tool) => tool.enabled).length;
  return {
    total: tools.length,
    enabled,
    disabled: tools.length - enabled
  };
}

export function buildToolCatalogPrompt(tools: ToolDescriptor[]): string {
  const enabledTools = tools.filter((tool) => tool.enabled);
  const disabledTools = tools.filter((tool) => !tool.enabled);
  const grepFilesTool = enabledTools.find((tool) => tool.name === 'grep_files');
  const summary = summarizeToolCatalog(tools);
  const lines = [
    'Role: Use Local MCP Bridge tools for workspaceRoot tasks in this conversation.',
    '',
    'Situation:',
    `- Current gateway catalog: ${summary.enabled} enabled / ${summary.total} total.`,
    '- For workspaceRoot file tasks, these bridge tools are the local source of truth even if unrelated built-in connectors are also visible.',
    '- workspaceRoot is the user host repository, not ChatGPT sandbox storage such as `/mnt/data`.',
    '- This is not a native MCP tool channel. An `mcp` block only asks the userscript to execute a tool.',
    '- You do not see tool output immediately. The authoritative result arrives later in a separate `tool_result` or `tool_result_batch` message inserted by the bridge.',
    '',
    'Instructions:',
    '- If the needed local path and tool are already clear, reply with only the required `mcp` block or blocks.',
    '- If the needed tool is unclear, reply with only an `mcp_list` block.',
    '- Use only enabled tools listed below.',
    '- Prefer bridge tools over unrelated built-in connectors for workspaceRoot tasks unless the user explicitly asks for those connectors.',
    '- Keep all file paths relative to workspaceRoot.',
    '- Do not reinterpret workspaceRoot paths as sandbox paths like `/mnt/data`.',
    '- For multiple tool calls in one assistant reply, emit multiple `mcp` blocks in execution order.',
    '- If no enabled bridge tool is relevant, answer normally without emitting any `mcp` block.',
    '',
    'Constraints before any `tool_result` arrives:',
    '- Do not explain, summarize, apologize, discuss workspace access, mention MCP execution status, or ask whether to continue.',
    '- Do not reveal intermediate reasoning, chain-of-thought, step-by-step planning, or any other thinking text while issuing tool calls.',
    '- Do not claim that a tool failed, was unavailable, was not executed, or already returned data unless a real `tool_result` shows that.',
    '- After emitting any `mcp` block, stop and wait for the later bridge result message before continuing.',
    '- Never invent, simulate, restate, or paraphrase `tool_result` or `tool_result_batch` payloads yourself.',
    '',
    'Enabled tools:'
  ];

  if (grepFilesTool) {
    lines.splice(18, 0,
      '- `grep_files` defaults to literal search: use `query` for one term or `patterns` for multiple literal terms.',
      '- Use `mode: "regex"` only when you intentionally need regex semantics; do not put `a|b|c` into a literal `query` and expect alternation.',
      ''
    );
  }

  for (const tool of enabledTools) {
    lines.push(`- ${tool.name}: ${tool.description}`);
    lines.push('```mcp');
    lines.push(JSON.stringify({ tool: tool.name, args: tool.exampleArgs }, null, 2));
    lines.push('```');
  }

  if (disabledTools.length > 0) {
    lines.push('', `Disabled tools (do not call): ${disabledTools.map((tool) => tool.name).join(', ')}`);
  }

  lines.push(
    '',
    'Output template:',
    '```mcp',
    '{',
    '  "tool": "tool_name",',
    '  "args": {',
    '    "key": "value"',
    '  }',
    '}',
    '```',
    '',
    'Output rules:',
    '- If you emit any fenced `mcp` block, do not add natural-language context before it.',
    '- Never output raw JSON outside fenced `mcp` blocks.',
    '- After the first fenced `mcp` block appears, do not add prose, analysis, or thinking text between or after tool-call blocks.',
    '',
    'If a needed local action is not possible, explain which specific bridge tool is disabled or missing instead of saying that no local bridge tools are available.',
    'Use `mcp_list` whenever you need to refresh the catalog in the middle of the conversation.'
  );
  return lines.join('\n');
}

export function buildInjectedToolPrompt(tools: ToolDescriptor[]): string {
  const enabledTools = tools.filter((tool) => tool.enabled);
  const disabledTools = tools.filter((tool) => !tool.enabled);
  const summary = summarizeToolCatalog(tools);
  const lines = [
    'Role: Use Local MCP Bridge tools for workspaceRoot tasks in this conversation.',
    '',
    'Situation:',
    `- Current gateway catalog: ${summary.enabled} enabled / ${summary.total} total.`,
    '- For workspaceRoot file tasks, these bridge tools are the local source of truth even if unrelated built-in connectors are also visible.',
    '- workspaceRoot is the user host repository, not ChatGPT sandbox storage such as `/mnt/data`.',
    '- This is not a native MCP tool channel. An `mcp` block only asks the userscript to execute a tool.',
    '- You do not see tool output immediately. The authoritative result arrives later in a separate `tool_result` or `tool_result_batch` message inserted by the bridge.',
    '',
    'Instructions:',
    '- If the needed local path and tool are already clear, reply with only the required `mcp` block or blocks.',
    '- If the needed tool is unclear, reply with only an `mcp_list` block.',
    '- Use only enabled tools.',
    '- Keep all file paths relative to workspaceRoot.',
    '- Do not reinterpret workspaceRoot paths as sandbox paths like `/mnt/data`.',
    '- Prefer bridge tools over unrelated built-in connectors for workspaceRoot tasks unless the user explicitly asks for those connectors.',
    '- For multi-step tasks, gather local context with read/search/list tools before discussing writes or summaries.',
    '- If no enabled bridge tool is relevant, answer normally without emitting any `mcp` block.',
    '',
    'Constraints before any `tool_result` arrives:',
    '- Do not explain, summarize, apologize, discuss workspace access, mention MCP execution status, or ask whether to continue.',
    '- Do not reveal intermediate reasoning, chain-of-thought, step-by-step planning, or any other thinking text while issuing tool calls.',
    '- Do not claim that a tool failed, was unavailable, was not executed, or already returned data unless a real `tool_result` shows that.',
    '- After emitting any `mcp` block, stop and wait for the later bridge result message before continuing.',
    '- Never invent, simulate, restate, or paraphrase `tool_result` or `tool_result_batch` payloads yourself.',
    '',
    'Enabled tools:'
  ];

  for (const tool of enabledTools) {
    lines.push(`- ${tool.name}: ${tool.description}`);
    lines.push('```mcp');
    lines.push(JSON.stringify({ tool: tool.name, args: tool.exampleArgs }, null, 2));
    lines.push('```');
  }

  if (disabledTools.length > 0) {
    lines.push('', `Disabled tools (do not call): ${disabledTools.map((tool) => tool.name).join(', ')}`);
  }

  lines.push(
    '',
    'Output template:',
    '```mcp',
    '{',
    '  "tool": "tool_name",',
    '  "args": {',
    '    "key": "value"',
    '  }',
    '}',
    '```',
    '',
    'Output rules:',
    '- If you emit any fenced `mcp` block, do not add natural-language context before it.',
    '- Never output raw JSON outside fenced `mcp` blocks.',
    '- After the first fenced `mcp` block appears, do not add prose, analysis, or thinking text between or after tool-call blocks.'
  );

  return lines.join('\n');
}
