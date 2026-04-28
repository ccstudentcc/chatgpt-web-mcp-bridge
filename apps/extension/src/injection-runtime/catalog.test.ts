import { describe, expect, it } from 'vitest';
import type { ToolDescriptor } from '@cwmb/tool-contracts';
import { buildInjectedToolPrompt, buildToolCatalogPrompt } from './catalog.js';

function createTool(overrides: Partial<ToolDescriptor> = {}): ToolDescriptor {
  return {
    name: 'read_file',
    title: 'Read file',
    description: 'Read a file.',
    risk: 'low',
    requiresConfirmation: false,
    enabled: true,
    exampleArgs: { path: 'README.md' },
    ...overrides
  };
}

describe('catalog prompt ownership wording', () => {
  it('keeps the visible tool catalog prompt free of archived userscript wording', () => {
    const prompt = buildToolCatalogPrompt([createTool()]);
    expect(prompt).toContain('Local MCP Bridge runtime');
    expect(prompt).not.toContain('userscript to execute a tool');
  });

  it('keeps the injected tool prompt free of archived userscript wording', () => {
    const prompt = buildInjectedToolPrompt([createTool()]);
    expect(prompt).toContain('Local MCP Bridge runtime');
    expect(prompt).not.toContain('userscript to execute a tool');
  });
});
