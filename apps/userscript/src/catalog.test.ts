import type { ToolDescriptor } from '@cwmb/protocol';
import { describe, expect, it } from 'vitest';
import { buildToolCatalogPrompt, summarizeToolCatalog } from './catalog.js';

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
    expect(prompt).toContain('```mcp');
    expect(prompt).toContain('"tool": "mcp_list"');
    expect(prompt).toContain('"tool": "read_file"');
    expect(prompt).toContain('`grep_files` defaults to literal search');
    expect(prompt).toContain('do not put `a|b|c` into a literal `query` and expect alternation');
    expect(prompt).toContain('Currently disabled tools (do not call): run_pwsh');
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
