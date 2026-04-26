import { describe, expect, it } from 'vitest';
import { parseMcpBlocks, parseMcpCandidateStrings, parseRenderedMcpBlocks } from './parser.js';

describe('parseMcpBlocks', () => {
  it('parses a valid mcp block', async () => {
    const result = await parseMcpBlocks('```mcp\n{"tool":"read_file","args":{"path":"README.md"}}\n```');
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.block.tool).toBe('read_file');
  });

  it('parses rendered code-block json candidates without markdown fences', async () => {
    const result = await parseMcpCandidateStrings(['{"tool":"read_file","args":{"path":"README.md"}}']);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.block.args.path).toBe('README.md');
  });

  it('preserves block order when multiple mcp blocks appear in the same reply', async () => {
    const result = await parseMcpBlocks([
      '```mcp',
      '{"tool":"read_file","args":{"path":"README.md"}}',
      '```',
      '',
      '```mcp',
      '{"tool":"grep_files","args":{"query":"todo"}}',
      '```'
    ].join('\n'));

    expect(result.blocks.map((block) => block.block.tool)).toEqual(['read_file', 'grep_files']);
  });

  it('reports invalid json', async () => {
    const result = await parseMcpBlocks('```mcp\n{"tool":\n```');
    expect(result.blocks).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('parses rendered candidates even when the block label is mixed into text content', async () => {
    const fakeContainer = {
      querySelectorAll: () => [
        { textContent: 'mcp\n{\n  "tool": "list_directory",\n  "args": {\n    "path": ".",\n    "maxDepth": 2\n  }\n}' }
      ]
    } as unknown as ParentNode;

    const result = await parseRenderedMcpBlocks(fakeContainer);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.block.tool).toBe('list_directory');
  });
});
