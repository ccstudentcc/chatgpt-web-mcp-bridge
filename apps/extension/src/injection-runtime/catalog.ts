import type { CatalogContract, CatalogSource, ToolDescriptor } from '@cwmb/tool-contracts';
import type { RequestInjectionMode, RequestPromptSnapshot } from './request-injection-state.js';

export interface ToolCatalogSummary {
  total: number;
  enabled: number;
  disabled: number;
}

export type RequestPromptSyncReason = 'bootstrap' | 'refresh';

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
  const summary = summarizeToolCatalog(tools);
  const lines = [
    'Role: Use Local MCP Bridge tools for workspaceRoot tasks in this conversation.',
    '',
    'Situation:',
    `- Current gateway catalog: ${summary.enabled} enabled / ${summary.total} total.`,
    '- For workspaceRoot file tasks, these bridge tools are the local source of truth even if unrelated built-in connectors are also visible.',
    '- workspaceRoot is the user host repository, not ChatGPT sandbox storage such as `/mnt/data`.',
    '- This is not a native MCP tool channel. An `mcp` block only asks the Local MCP Bridge runtime to execute a tool.',
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
    '- Never invent, simulate, restate, or paraphrase `tool_result` or `tool_result_batch` payloads yourself.'
  ];

  appendCatalogToolSections(lines, enabledTools, disabledTools);

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
    '- You may add brief natural-language context before the first fenced `mcp` block when it helps frame the next local action.',
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
    '- This is not a native MCP tool channel. An `mcp` block only asks the Local MCP Bridge runtime to execute a tool.',
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
    '- Never invent, simulate, restate, or paraphrase `tool_result` or `tool_result_batch` payloads yourself.'
  ];

  appendCatalogToolSections(lines, enabledTools, disabledTools);

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
    '- You may add brief natural-language context before the first fenced `mcp` block when it helps frame the next local action.',
    '- Never output raw JSON outside fenced `mcp` blocks.',
    '- After the first fenced `mcp` block appears, do not add prose, analysis, or thinking text between or after tool-call blocks.'
  );

  return lines.join('\n');
}

export function createRequestPromptSnapshot(
  catalog: CatalogContract,
  mode: RequestInjectionMode,
  source: CatalogSource
): RequestPromptSnapshot {
  return {
    prompt: buildInjectedToolPrompt(catalog.tools),
    mode,
    source,
    catalogVersion: catalog.catalogVersion
  };
}

export function describeRequestPromptSync(detail: {
  catalog: CatalogContract;
  source: CatalogSource;
  reason: RequestPromptSyncReason;
}): {
  level: 'info' | 'success';
  message: string;
} {
  const summary = summarizeToolCatalog(detail.catalog.tools);
  const catalogDescriptor = `${summary.enabled}/${summary.total} enabled, ${detail.catalog.catalogVersion}`;
  if (detail.source === 'cache') {
    return {
      level: 'info',
      message: `Seeded hidden request injection from cached bootstrap catalog (${catalogDescriptor}) while waiting for live /tools sync.`
    };
  }

  return {
    level: 'success',
    message: detail.reason === 'bootstrap'
      ? `Live /tools catalog (${catalogDescriptor}) was ready before the first request-hook warmup window closed.`
      : `Live /tools catalog (${catalogDescriptor}) is now driving hidden request injection.`
  };
}

function appendCatalogToolSections(
  lines: string[],
  enabledTools: ToolDescriptor[],
  disabledTools: ToolDescriptor[]
): void {
  lines.push('', 'Enabled tools:');
  appendSharedToolGuidance(lines, enabledTools);

  for (const tool of enabledTools) {
    lines.push(`- ${tool.name}: ${tool.description}`);
    lines.push('```mcp');
    lines.push(JSON.stringify({ tool: tool.name, args: tool.exampleArgs }, null, 2));
    lines.push('```');
  }

  if (disabledTools.length > 0) {
    lines.push('', `Disabled tools (do not call): ${disabledTools.map((tool) => tool.name).join(', ')}`);
  }
}

function appendSharedToolGuidance(lines: string[], enabledTools: ToolDescriptor[]): void {
  for (const tool of enabledTools) {
    const guidance = getToolUsageGuidance(tool.name);
    if (guidance.length > 0) {
      lines.push(...guidance);
    }
  }

  if (lines[lines.length - 1] !== '') {
    lines.push('');
  }
}

function getToolUsageGuidance(toolName: string): string[] {
  switch (toolName) {
    case 'mcp_list':
      return [
        '- Use `mcp_list` to refresh the enabled-tool catalog when the right bridge tool is unclear.'
      ];
    case 'read_file':
      return [
        '- Use `read_file` when you already know the exact relative path and need file contents, not file discovery.'
      ];
    case 'list_directory':
      return [
        '- Use `list_directory` to inspect folder structure; start at the narrowest relevant path and keep `maxDepth` small.'
      ];
    case 'search_files':
      return [
        '- Use `search_files` to find candidate paths by filename or relative path; it does not search file contents.'
      ];
    case 'grep_files':
      return [
        '- Use `grep_files` for file-content search. It defaults to literal matching: `query` for one term, `patterns` for multiple terms.',
        '- Set `mode: "regex"` explicitly for anchors or operators such as `^`, `$`, `.`, `[]`, `()`, or alternation like `a|b|c`.'
      ];
    case 'write_file':
      return [
        '- Use `write_file` for direct text edits only after read/search/list steps have already confirmed the target path and intended content.'
      ];
    case 'write_file_proposal':
      return [
        '- Use `write_file_proposal` to propose a patch-shaped edit before any direct write path is approved or enabled.'
      ];
    case 'run_pwsh':
      return [
        '- Use `run_pwsh` only for explicitly enabled host-side PowerShell execution, not normal workspace file inspection.'
      ];
    default:
      return [];
  }
}
