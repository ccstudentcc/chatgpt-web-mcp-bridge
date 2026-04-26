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
    'Local MCP bridge tools are available in this chat.',
    'When you need local context, output one or more fenced `mcp` JSON blocks and nothing else inside those blocks.',
    '',
    `Current gateway catalog: ${summary.enabled} enabled / ${summary.total} total.`,
    '',
    'Rules:',
    '- If you are unsure what is currently available, call `mcp_list` first.',
    '- Use only enabled tools listed below.',
    '- Keep all file paths relative to workspaceRoot.',
    '- For multiple tool calls in one assistant reply, emit multiple `mcp` blocks in execution order.',
    '',
    'Enabled tools:'
  ];

  if (grepFilesTool) {
    lines.splice(10, 0,
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
    lines.push('', `Currently disabled tools (do not call): ${disabledTools.map((tool) => tool.name).join(', ')}`);
  }

  lines.push('', 'Use `mcp_list` whenever you need to refresh the catalog in the middle of the conversation.');
  return lines.join('\n');
}
