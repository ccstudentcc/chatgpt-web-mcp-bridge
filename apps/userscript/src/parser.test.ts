import { describe, expect, it } from 'vitest';
import { parseMcpBlocks } from './parser.js';

describe('parseMcpBlocks', () => {
  it('parses a valid mcp block', async () => {
    const result = await parseMcpBlocks('```mcp\n{"tool":"read_file","args":{"path":"README.md"}}\n```');
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.block.tool).toBe('read_file');
  });

  it('reports invalid json', async () => {
    const result = await parseMcpBlocks('```mcp\n{"tool":\n```');
    expect(result.blocks).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
