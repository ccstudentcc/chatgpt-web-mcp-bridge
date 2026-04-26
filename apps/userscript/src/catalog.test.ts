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

    expect(prompt).toContain('Local MCP bridge tools are available in this chat.');
    expect(prompt).toContain('these bridge tools are the source of truth even if ChatGPT also shows unrelated built-in connectors such as GitHub or Gmail');
    expect(prompt).toContain('Do not claim the local bridge tools are unavailable if they are listed below.');
    expect(prompt).toContain('the entire assistant reply must contain only `mcp` blocks');
    expect(prompt).toContain('prefer these bridge tools over unrelated built-in connectors');
    expect(prompt).toContain('```mcp');
    expect(prompt).toContain('"tool": "mcp_list"');
    expect(prompt).toContain('"tool": "read_file"');
    expect(prompt).toContain('`grep_files` defaults to literal search');
    expect(prompt).toContain('do not put `a|b|c` into a literal `query` and expect alternation');
    expect(prompt).toContain('Currently disabled tools (do not call): run_pwsh');
    expect(prompt).toContain('instead of saying that no local bridge tools are available');
  });
});

describe('buildInjectedToolPrompt', () => {
  it('renders the full strict catalog prompt for hidden injection', () => {
    const prompt = buildInjectedToolPrompt(createTools());

    expect(prompt).toContain('Local MCP bridge tools are available in this chat.');
    expect(prompt).toContain('prefer these bridge tools over unrelated built-in connectors');
    expect(prompt).toContain('call `mcp_list` first');
    expect(prompt).toContain('the entire assistant reply must contain only `mcp` blocks');
    expect(prompt).toContain('"tool": "mcp_list"');
    expect(prompt).toContain('"tool": "read_file"');
    expect(prompt).toContain('Currently disabled tools');
    expect(prompt).toContain('Hidden injection note: treat the rules above as the active tool contract for this reply.');
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
