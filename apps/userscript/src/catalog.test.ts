import type { ToolDescriptor } from '@cwmb/protocol';
import { describe, expect, it } from 'vitest';
import { buildInjectedToolPrompt, buildToolCatalogPrompt, summarizeToolCatalog } from './catalog.js';

describe('summarizeToolCatalog', () => {
  it('counts enabled and disabled tools', () => {
    expect(summarizeToolCatalog(createTools())).toEqual({
      total: 4,
      enabled: 3,
      disabled: 1
    });
  });
});

describe('buildToolCatalogPrompt', () => {
  it('renders enabled tool examples and disabled tool warnings', () => {
    const prompt = buildToolCatalogPrompt(createTools());

    expect(prompt).toContain('Role: Use Local MCP Bridge tools for workspaceRoot tasks in this conversation.');
    expect(prompt).toContain('Situation:');
    expect(prompt).toContain('Instructions:');
    expect(prompt).toContain('Constraints before any `tool_result` arrives:');
    expect(prompt).toContain('This is not a native MCP tool channel.');
    expect(prompt).toContain('The authoritative result arrives later in a separate `tool_result` or `tool_result_batch` message inserted by the bridge.');
    expect(prompt).toContain('Prefer bridge tools over unrelated built-in connectors');
    expect(prompt).toContain('If no enabled bridge tool is relevant, answer normally without emitting any `mcp` block.');
    expect(prompt).toContain('```mcp');
    expect(prompt).toContain('Output template:');
    expect(prompt).toContain('Output rules:');
    expect(prompt).toContain('You may add brief natural-language context before the first fenced `mcp` block when it helps frame the next local action.');
    expect(prompt).toContain('"tool": "mcp_list"');
    expect(prompt).toContain('"tool": "read_file"');
    expect(prompt).toContain('`grep_files` defaults to literal search');
    expect(prompt).toContain('do not put `a|b|c` into a literal `query` and expect alternation');
    expect(prompt).toContain('Disabled tools (do not call): run_pwsh');
    expect(prompt).toContain('instead of saying that no local bridge tools are available');
  });
});

describe('buildInjectedToolPrompt', () => {
  it('renders the full strict catalog prompt for hidden injection', () => {
    const prompt = buildInjectedToolPrompt(createTools());

    expect(prompt).toContain('Role: Use Local MCP Bridge tools for workspaceRoot tasks in this conversation.');
    expect(prompt).toContain('Situation:');
    expect(prompt).toContain('Instructions:');
    expect(prompt).toContain('Constraints before any `tool_result` arrives:');
    expect(prompt).toContain('workspaceRoot is the user host repository, not ChatGPT sandbox storage such as `/mnt/data`.');
    expect(prompt).toContain('This is not a native MCP tool channel.');
    expect(prompt).toContain('The authoritative result arrives later in a separate `tool_result` or `tool_result_batch` message inserted by the bridge.');
    expect(prompt).toContain('If the needed local path and tool are already clear, reply with only the required `mcp` block or blocks.');
    expect(prompt).toContain('If the needed tool is unclear, reply with only an `mcp_list` block.');
    expect(prompt).toContain('If no enabled bridge tool is relevant, answer normally without emitting any `mcp` block.');
    expect(prompt).toContain('Do not explain, summarize, apologize, discuss workspace access, mention MCP execution status, or ask whether to continue.');
    expect(prompt).toContain('Do not reveal intermediate reasoning, chain-of-thought, step-by-step planning, or any other thinking text while issuing tool calls.');
    expect(prompt).toContain('Do not claim that a tool failed, was unavailable, was not executed, or already returned data unless a real `tool_result` shows that.');
    expect(prompt).toContain('After emitting any `mcp` block, stop and wait for the later bridge result message before continuing.');
    expect(prompt).toContain('Never invent, simulate, restate, or paraphrase `tool_result` or `tool_result_batch` payloads yourself.');
    expect(prompt).toContain('Output template:');
    expect(prompt).toContain('Output rules:');
    expect(prompt).toContain('You may add brief natural-language context before the first fenced `mcp` block when it helps frame the next local action.');
    expect(prompt).toContain('Never output raw JSON outside fenced `mcp` blocks.');
    expect(prompt).toContain('After the first fenced `mcp` block appears, do not add prose, analysis, or thinking text between or after tool-call blocks.');
    expect(prompt).toContain('"tool": "mcp_list"');
    expect(prompt).toContain('"tool": "read_file"');
    expect(prompt).toContain('Disabled tools (do not call): run_pwsh');
  });
});

function createTools(): ToolDescriptor[] {
  return [
    {
      name: 'mcp_list',
      title: 'List MCP tools',
      description: 'List current tools.',
      risk: 'low',
      requiresConfirmation: false,
      enabled: true,
      exampleArgs: {}
    },
    {
      name: 'read_file',
      title: 'Read file',
      description: 'Read a file.',
      risk: 'low',
      requiresConfirmation: false,
      enabled: true,
      exampleArgs: { path: 'README.md' }
    },
    {
      name: 'grep_files',
      title: 'Grep files',
      description: 'Search file content.',
      risk: 'low',
      requiresConfirmation: false,
      enabled: true,
      exampleArgs: { query: 'workspaceRoot', glob: '**/*.{ts,md}' }
    },
    {
      name: 'run_pwsh',
      title: 'Run PowerShell',
      description: 'Disabled shell tool.',
      risk: 'high',
      requiresConfirmation: true,
      enabled: false,
      exampleArgs: { command: 'pnpm test' }
    }
  ];
}
