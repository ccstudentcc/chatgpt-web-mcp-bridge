import { describe, expect, it } from 'vitest';
import { analyzeMcpTurn, parseMcpBlocks, parseMcpCandidateStrings, parseRenderedMcpBlocks } from './parser.js';

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

describe('analyzeMcpTurn', () => {
  it('accepts a pure rendered MCP tool-call turn', async () => {
    const visibleText = 'mcp\n{\n  "tool": "read_file",\n  "args": {\n    "path": "SPEC.md"\n  }\n}';
    const fakeContainer = {
      querySelectorAll: () => [{ textContent: visibleText }]
    } as unknown as ParentNode;

    const result = await analyzeMcpTurn(fakeContainer, visibleText);
    expect(result.status).toBe('valid');
    expect(result.blocks).toHaveLength(1);
  });

  it('ignores rendered json blocks that are not explicitly labeled as mcp', async () => {
    const visibleText = '{\n  "tool": "read_file",\n  "args": {\n    "path": "SPEC.md"\n  }\n}';
    const fakeContainer = {
      querySelectorAll: () => [{ textContent: visibleText }]
    } as unknown as ParentNode;

    const result = await analyzeMcpTurn(fakeContainer, visibleText);
    expect(result.status).toBe('none');
    expect(result.blocks).toHaveLength(0);
  });

  it('rejects a rendered MCP turn mixed with natural language', async () => {
    const codeText = 'mcp\n{\n  "tool": "read_file",\n  "args": {\n    "path": "SPEC.md"\n  }\n}';
    const visibleText = `读取 SPEC.md，总结一下\n\n${codeText}`;
    const fakeContainer = {
      querySelectorAll: () => [{ textContent: codeText }]
    } as unknown as ParentNode;

    const result = await analyzeMcpTurn(fakeContainer, visibleText);
    expect(result.status).toBe('invalid');
    expect(result.violationReason).toContain('natural language');
  });

  it('recovers when a valid MCP block is mixed only with unfenced MCP-like json noise', async () => {
    const codeText = 'mcp\n{\n  "tool": "read_file",\n  "args": {\n    "path": "SPEC.md"\n  }\n}';
    const visibleText = [
      '{',
      '  "tool": "list_directory",',
      '  "args": {',
      '    "path": ".",',
      '    "maxDepth": 2',
      '  }',
      '}',
      '',
      codeText
    ].join('\n');
    const fakeContainer = {
      querySelectorAll: () => [{ textContent: codeText }]
    } as unknown as ParentNode;

    const result = await analyzeMcpTurn(fakeContainer, visibleText);
    expect(result.status).toBe('recoverable');
    expect(result.warningReason).toContain('Ignoring the unfenced fragment');
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.block.tool).toBe('read_file');
  });

  it('rejects a fenced MCP turn mixed with extra text', async () => {
    const visibleText = [
      '请先确认文件是否存在。',
      '```mcp',
      '{"tool":"read_file","args":{"path":"SPEC.md"}}',
      '```'
    ].join('\n');
    const fakeContainer = {
      querySelectorAll: () => []
    } as unknown as ParentNode;

    const result = await analyzeMcpTurn(fakeContainer, visibleText);
    expect(result.status).toBe('invalid');
    expect(result.violationReason).toContain('natural language');
  });

  it('prefers a valid fenced MCP block over malformed rendered candidates', async () => {
    const visibleText = [
      '```mcp',
      '{"tool":"read_file","args":{"path":"SPEC.md"}}',
      '```'
    ].join('\n');
    const fakeContainer = {
      querySelectorAll: () => [{ textContent: 'mcp\n{"tool": "read_file",' }]
    } as unknown as ParentNode;

    const result = await analyzeMcpTurn(fakeContainer, visibleText);
    expect(result.status).toBe('valid');
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.block.tool).toBe('read_file');
  });
});
