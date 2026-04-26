import type { ToolDescriptor } from '@cwmb/protocol';
import { describe, expect, it } from 'vitest';
import { assessPendingTools, formatCapabilityLabel } from './capabilities.js';
import type { ParsedMcpBlock } from './parser.js';

describe('assessPendingTools', () => {
  it('marks a batch runnable when every tool is enabled', () => {
    const assessment = assessPendingTools(createBlocks(2), createTools(), true);
    expect(assessment.runnable).toBe(true);
    expect(assessment.highestRisk).toBe('medium');
    expect(assessment.items.map((item) => item.state)).toEqual(['enabled', 'enabled']);
  });

  it('blocks disabled tools and explains why they cannot run', () => {
    const tools = createTools();
    tools[1] = { ...tools[1], enabled: false };
    const assessment = assessPendingTools(createBlocks(2), tools, true);

    expect(assessment.runnable).toBe(false);
    expect(assessment.blockedReason).toContain('currently disabled');
    expect(assessment.items[1]?.state).toBe('disabled');
  });

  it('blocks execution while the tool catalog is unavailable', () => {
    const assessment = assessPendingTools(createBlocks(1), [], false);
    expect(assessment.runnable).toBe(false);
    expect(assessment.items[0]?.state).toBe('catalog_unavailable');
  });

  it('marks unknown tools as unsupported', () => {
    const assessment = assessPendingTools(createBlocks(3), createTools(), true);
    expect(assessment.runnable).toBe(false);
    expect(assessment.items[2]?.state).toBe('unsupported');
  });
});

describe('formatCapabilityLabel', () => {
  it('renders user-facing labels for capability states', () => {
    expect(formatCapabilityLabel({ block: createBlocks(1)[0]!, state: 'enabled' })).toBe('enabled');
    expect(formatCapabilityLabel({ block: createBlocks(1)[0]!, state: 'catalog_unavailable' })).toBe('catalog unavailable');
  });
});

function createTools(): ToolDescriptor[] {
  return [
    {
      name: 'read_file',
      title: 'Read file',
      description: 'Read a text file.',
      risk: 'low',
      requiresConfirmation: false,
      enabled: true
    },
    {
      name: 'grep_files',
      title: 'Grep files',
      description: 'Search file content.',
      risk: 'medium',
      requiresConfirmation: false,
      enabled: true
    }
  ];
}

function createBlocks(count = 2): ParsedMcpBlock[] {
  return [
    {
      block: { tool: 'read_file', args: { path: 'README.md' } },
      raw: '{"tool":"read_file","args":{"path":"README.md"}}',
      callId: 'call-read'
    },
    {
      block: { tool: 'grep_files', args: { pattern: 'todo' } },
      raw: '{"tool":"grep_files","args":{"pattern":"todo"}}',
      callId: 'call-grep'
    },
    {
      block: { tool: 'run_pwsh', args: { command: 'pnpm test' } },
      raw: '{"tool":"run_pwsh","args":{"command":"pnpm test"}}',
      callId: 'call-pwsh'
    }
  ].slice(0, count);
}
