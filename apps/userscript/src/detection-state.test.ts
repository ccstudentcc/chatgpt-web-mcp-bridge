import { describe, expect, it } from 'vitest';
import { isSamePendingSelection, updatePendingInvalidTurn } from './detection-state.js';
import type { ParsedMcpBlock } from './parser.js';

describe('isSamePendingSelection', () => {
  it('treats the same pending call ids as unchanged', () => {
    const current = createBlocks(['call-a', 'call-b']);
    const next = createBlocks(['call-a', 'call-b']);

    expect(isSamePendingSelection(current, 'batch-1', next, 'batch-1')).toBe(true);
  });

  it('treats a changed batch or call order as new pending work', () => {
    const current = createBlocks(['call-a', 'call-b']);
    const reordered = createBlocks(['call-b', 'call-a']);

    expect(isSamePendingSelection(current, 'batch-1', reordered, 'batch-1')).toBe(false);
    expect(isSamePendingSelection(current, 'batch-1', current, 'batch-2')).toBe(false);
  });
});

describe('updatePendingInvalidTurn', () => {
  it('waits for the same invalid reply snapshot to remain stable before blocking', () => {
    const candidate = {
      messageId: 'msg-1',
      reason: 'invalid mcp',
      fingerprint: 'snapshot-a'
    };

    const first = updatePendingInvalidTurn(null, candidate, 1_000, 2_000);
    expect(first.shouldBlock).toBe(false);

    const second = updatePendingInvalidTurn(first.next, candidate, 2_500, 2_000);
    expect(second.shouldBlock).toBe(false);

    const third = updatePendingInvalidTurn(second.next, candidate, 3_000, 2_000);
    expect(third.shouldBlock).toBe(true);
  });

  it('resets the grace window when the streaming reply keeps changing', () => {
    const initial = updatePendingInvalidTurn(null, {
      messageId: 'msg-1',
      reason: 'invalid mcp',
      fingerprint: 'snapshot-a'
    }, 1_000, 2_000);

    const changed = updatePendingInvalidTurn(initial.next, {
      messageId: 'msg-1',
      reason: 'invalid mcp',
      fingerprint: 'snapshot-b'
    }, 2_900, 2_000);

    expect(changed.shouldBlock).toBe(false);
    expect(changed.next.firstSeenAt).toBe(2_900);
  });
});

function createBlocks(callIds: string[]): ParsedMcpBlock[] {
  return callIds.map((callId, index) => ({
    block: {
      tool: index === 0 ? 'read_file' : 'grep_files',
      args: index === 0 ? { path: 'README.md' } : { query: 'todo' }
    },
    raw: index === 0
      ? '{"tool":"read_file","args":{"path":"README.md"}}'
      : '{"tool":"grep_files","args":{"query":"todo"}}',
    callId
  }));
}
