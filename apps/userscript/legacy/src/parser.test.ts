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

  it('assigns stable call ids for the same raw MCP candidate', async () => {
    const raw = '{"tool":"read_file","args":{"path":"README.md"}}';
    const first = await parseMcpCandidateStrings([raw]);
    const second = await parseMcpCandidateStrings([raw]);

    expect(first.blocks[0]?.callId).toBeTruthy();
    expect(first.blocks[0]?.callId).toBe(second.blocks[0]?.callId);
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

  it('accepts a pure rendered MCP tool-call turn from visible text even without rendered DOM candidates', async () => {
    const visibleText = 'mcp\n{\n  "tool": "read_file",\n  "args": {\n    "path": "SPEC.md"\n  }\n}';
    const fakeContainer = {
      querySelectorAll: () => []
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

  it('accepts a rendered MCP turn with natural-language context before the first MCP block', async () => {
    const codeText = 'mcp\n{\n  "tool": "read_file",\n  "args": {\n    "path": "SPEC.md"\n  }\n}';
    const visibleText = `读取 SPEC.md，总结一下\n\n${codeText}`;
    const fakeContainer = {
      querySelectorAll: () => [{ textContent: codeText }]
    } as unknown as ParentNode;

    const result = await analyzeMcpTurn(fakeContainer, visibleText);
    expect(result.status).toBe('valid');
    expect(result.blocks).toHaveLength(1);
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

  it('accepts a fenced MCP turn with a natural-language prefix', async () => {
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
    expect(result.status).toBe('valid');
    expect(result.blocks).toHaveLength(1);
  });

  it('rejects a fenced MCP turn with extra text after the block', async () => {
    const visibleText = [
      '```mcp',
      '{"tool":"read_file","args":{"path":"SPEC.md"}}',
      '```',
      '',
      '然后总结一下。'
    ].join('\n');
    const fakeContainer = {
      querySelectorAll: () => []
    } as unknown as ParentNode;

    const result = await analyzeMcpTurn(fakeContainer, visibleText);
    expect(result.status).toBe('invalid');
    expect(result.violationReason).toContain('after MCP tool-call blocks');
  });

  it('recovers when a valid MCP block is followed only by a ChatGPT thinking label', async () => {
    const codeText = 'mcp\n{\n  "tool": "read_file",\n  "args": {\n    "path": "docs/prd_vnext.md"\n  }\n}';
    const visibleText = [
      codeText,
      '',
      'Thought for a couple of seconds'
    ].join('\n');
    const fakeContainer = {
      querySelectorAll: () => [{ textContent: codeText }]
    } as unknown as ParentNode;

    const result = await analyzeMcpTurn(fakeContainer, visibleText);
    expect(result.status).toBe('recoverable');
    expect(result.warningReason).toContain('thinking/status label');
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.block.args.path).toBe('docs/prd_vnext.md');
  });

  it('recovers when a valid MCP block is preceded only by a ChatGPT thinking label', async () => {
    const codeText = 'mcp\n{\n  "tool": "read_file",\n  "args": {\n    "path": "docs/prd_vnext.md"\n  }\n}';
    const visibleText = [
      'Thought for a couple of seconds',
      '',
      codeText
    ].join('\n');
    const fakeContainer = {
      querySelectorAll: () => [{ textContent: codeText }]
    } as unknown as ParentNode;

    const result = await analyzeMcpTurn(fakeContainer, visibleText);
    expect(result.status).toBe('recoverable');
    expect(result.warningReason).toContain('thinking/status label before valid MCP blocks');
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.block.args.path).toBe('docs/prd_vnext.md');
  });

  it('rejects prose between two fenced MCP blocks', async () => {
    const visibleText = [
      '```mcp',
      '{"tool":"read_file","args":{"path":"SPEC.md"}}',
      '```',
      '',
      '接着再调一次。',
      '',
      '```mcp',
      '{"tool":"grep_files","args":{"query":"mcp"}}',
      '```'
    ].join('\n');
    const fakeContainer = {
      querySelectorAll: () => []
    } as unknown as ParentNode;

    const result = await analyzeMcpTurn(fakeContainer, visibleText);
    expect(result.status).toBe('invalid');
    expect(result.violationReason).toContain('after MCP tool-call blocks');
  });

  it('rejects the exact pattern of prose before and after a fenced MCP block', async () => {
    const visibleText = [
      '我准备读取项目根目录下的 `README.md` 文件内容。',
      '',
      '```mcp',
      '{',
      '  "tool": "read_file",',
      '  "args": {',
      '    "path": "README.md"',
      '  }',
      '}',
      '```',
      '',
      '已完成。'
    ].join('\n');
    const fakeContainer = {
      querySelectorAll: () => []
    } as unknown as ParentNode;

    const result = await analyzeMcpTurn(fakeContainer, visibleText);
    expect(result.status).toBe('invalid');
    expect(result.violationReason).toContain('non-block content');
  });

  it('rejects prose-wrapped rendered MCP turns even when DOM candidates normalize to a different JSON layout', async () => {
    const visibleText = [
      '我将读取项目根目录下的 README.md 文件内容。',
      '',
      'mcp',
      '{',
      '  "tool": "read_file",',
      '  "args": {',
      '    "path": "README.md"',
      '  }',
      '}',
      '',
      '已完成。'
    ].join('\n');
    const fakeContainer = {
      querySelectorAll: () => [{
        textContent: 'mcp\n{"tool":"read_file","args":{"path":"README.md"}}'
      }]
    } as unknown as ParentNode;

    const result = await analyzeMcpTurn(fakeContainer, visibleText);
    expect(result.status).toBe('invalid');
    expect(result.violationReason).toContain('non-block content');
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

  it('accepts rendered fallback cases when natural-language prefix appears before the fenced MCP block', async () => {
    const visibleText = [
      '好的，我们先从 `catalog.ts` 开始，逐步分析每个模块的源码，并提炼优化点和重构策略。首先读取 `catalog.ts` 的完整内容。',
      '',
      '```mcp',
      '{',
      '  "tool": "read_file",',
      '  "args": {',
      '    "path": "apps/userscript/src/catalog.ts"',
      '  }',
      '}',
      '```'
    ].join('\n');
    const fakeContainer = {
      querySelectorAll: () => [{
        textContent: 'mcp\n{\n  "tool": "read_file",\n  "args": {\n    "path": "apps/userscript/src/catalog.ts"\n  }\n}\n复制'
      }]
    } as unknown as ParentNode;

    const result = await analyzeMcpTurn(fakeContainer, visibleText);
    expect(result.status).toBe('valid');
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.block.args.path).toBe('apps/userscript/src/catalog.ts');
  });

  it('accepts a pure rendered MCP turn when the label line is separated from the json body by a newline', async () => {
    const visibleText = 'mcp\n{\n  "tool": "read_file",\n  "args": {\n    "path": "apps/userscript/src/batch.ts"\n  }\n}';
    const fakeContainer = {
      querySelectorAll: () => [{
        textContent: 'mcp\n{\n  "tool": "read_file",\n  "args": {\n    "path": "apps/userscript/src/batch.ts"\n  }\n}'
      }]
    } as unknown as ParentNode;

    const result = await analyzeMcpTurn(fakeContainer, visibleText);
    expect(result.status).toBe('valid');
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.block.args.path).toBe('apps/userscript/src/batch.ts');
  });
});
