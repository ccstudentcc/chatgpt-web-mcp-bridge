import type { ToolCallRequest, ToolCallResponse } from '@cwmb/protocol';
import { describe, expect, it, vi } from 'vitest';
import { createBatchId, executeBatch } from './batch.js';
import type { ParsedMcpBlock } from './parser.js';

describe('createBatchId', () => {
  it('is stable for the same message identity and raw block order', async () => {
    const blocks = [
      { raw: '{"tool":"read_file","args":{"path":"README.md"}}' },
      { raw: '{"tool":"grep_files","args":{"pattern":"todo"}}' }
    ];

    await expect(createBatchId('assistant-1', blocks)).resolves.toBe(await createBatchId('assistant-1', blocks));
  });
});

describe('executeBatch', () => {
  it('returns a full success batch result', async () => {
    const blocks = createBlocks();
    const executeTool = vi.fn<(_: ToolCallRequest) => Promise<ToolCallResponse>>().mockImplementation(async (request) => ({
      ok: true,
      tool: request.tool,
      result: { echoed: request.tool },
      warnings: request.tool === 'grep_files' ? ['Result truncated from 1000 chars.'] : [],
      durationMs: 5
    }));

    const result = await executeBatch({
      batchId: 'batch-1',
      messageId: 'assistant-1',
      blocks,
      executeTool
    });

    expect(executeTool).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({
      total: 2,
      completed: 2,
      failed: 0,
      skipped: 0,
      stoppedOnFailure: false
    });
    expect(result.warnings).toEqual(['Result truncated from 1000 chars.']);
    expect(result.items[0]).toMatchObject({ index: 0, tool: 'read_file', ok: true });
    expect(result.items[1]).toMatchObject({ index: 1, tool: 'grep_files', ok: true });
  });

  it('stops on the first failure and marks the rest as skipped', async () => {
    const blocks = createBlocks(3);
    const executeTool = vi.fn<(_: ToolCallRequest) => Promise<ToolCallResponse>>().mockImplementation(async (request) => {
      if (request.tool === 'grep_files') {
        return {
          ok: false,
          tool: request.tool,
          error: {
            code: 'PATH_OUTSIDE_WORKSPACE',
            message: 'Outside workspace.'
          },
          warnings: [],
          durationMs: 3
        };
      }

      return {
        ok: true,
        tool: request.tool,
        result: { echoed: request.tool },
        warnings: [],
        durationMs: 2
      };
    });

    const result = await executeBatch({
      batchId: 'batch-2',
      messageId: 'assistant-2',
      blocks,
      executeTool
    });

    expect(executeTool).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
    expect(result.summary).toEqual({
      total: 3,
      completed: 1,
      failed: 1,
      skipped: 1,
      stoppedOnFailure: true
    });
    expect(result.items[1]).toMatchObject({ index: 1, tool: 'grep_files', ok: false });
    expect(result.items[2]).toMatchObject({
      index: 2,
      tool: 'list_directory',
      status: 'skipped',
      reason: 'SKIPPED_AFTER_BATCH_FAILURE'
    });
  });

  it('reports progress in original execution order', async () => {
    const blocks = createBlocks(3);
    const progress: string[] = [];
    const executeTool = vi.fn<(_: ToolCallRequest) => Promise<ToolCallResponse>>().mockResolvedValue({
      ok: true,
      tool: 'read_file',
      result: { ok: true },
      warnings: [],
      durationMs: 1
    });

    await executeBatch({
      batchId: 'batch-3',
      messageId: 'assistant-3',
      blocks,
      executeTool,
      onProgress: ({ current, total, tool }) => {
        progress.push(`${current}/${total}:${tool}`);
      }
    });

    expect(progress).toEqual(['1/3:read_file', '2/3:grep_files', '3/3:list_directory']);
  });
});

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
      block: { tool: 'list_directory', args: { path: 'docs' } },
      raw: '{"tool":"list_directory","args":{"path":"docs"}}',
      callId: 'call-list'
    }
  ].slice(0, count);
}
