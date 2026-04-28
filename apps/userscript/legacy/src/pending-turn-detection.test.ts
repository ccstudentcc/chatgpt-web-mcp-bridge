import { describe, expect, it } from 'vitest';
import {
  detectPendingTurn,
  getMessageIdentity,
  trackMessageIdentity,
  type PendingTurnBlock
} from '../../extension/src/turn-runtime/pending-turn-detection.js';
import type { McpTurnAnalysis } from '../../extension/src/turn-runtime/mcp-turn-analysis.js';

function createAnalysis(
  status: McpTurnAnalysis['status'],
  blocks: PendingTurnBlock[] = [],
  extra: Partial<McpTurnAnalysis> = {}
): McpTurnAnalysis {
  return {
    status,
    blocks,
    errors: [],
    ...extra
  };
}

describe('getMessageIdentity', () => {
  it('prefers the outer ChatGPT turn id when present', () => {
    const message = {
      dataset: {
        turnId: 'request-WEB:assistant-42',
        messageId: 'assistant-42'
      },
      id: ''
    } as unknown as HTMLElement;

    const result = getMessageIdentity(message, 'hello', {
      ephemeralMessageIds: new WeakMap(),
      nextEphemeralMessageId: 3
    });

    expect(result).toEqual({
      messageId: 'request-WEB:assistant-42',
      nextEphemeralMessageId: 3
    });
  });

  it('reuses explicit message ids without advancing the ephemeral counter', () => {
    const message = {
      dataset: {
        messageId: 'assistant-42'
      },
      id: ''
    } as unknown as HTMLElement;

    const result = getMessageIdentity(message, 'hello', {
      ephemeralMessageIds: new WeakMap(),
      nextEphemeralMessageId: 3
    });

    expect(result).toEqual({
      messageId: 'assistant-42',
      nextEphemeralMessageId: 3
    });
  });

  it('creates and reuses ephemeral ids for the same message object', () => {
    const message = {
      dataset: {},
      id: ''
    } as unknown as HTMLElement;
    const ephemeralMessageIds = new WeakMap<HTMLElement, string>();

    const first = getMessageIdentity(message, 'read SPEC first', {
      ephemeralMessageIds,
      nextEphemeralMessageId: 1
    });
    const second = getMessageIdentity(message, 'read SPEC first', {
      ephemeralMessageIds,
      nextEphemeralMessageId: first.nextEphemeralMessageId
    });

    expect(first.messageId).toContain('ephemeral-message-1');
    expect(second.messageId).toBe(first.messageId);
    expect(second.nextEphemeralMessageId).toBe(2);
  });
});

describe('trackMessageIdentity', () => {
  it('returns the message id together with the next identity context', () => {
    const message = {
      dataset: {},
      id: ''
    } as unknown as HTMLElement;

    const result = trackMessageIdentity(message, 'request latest bridge status', {
      ephemeralMessageIds: new WeakMap(),
      nextEphemeralMessageId: 5
    });

    expect(result.messageId).toContain('ephemeral-message-5');
    expect(result.nextState.nextEphemeralMessageId).toBe(6);
  });
});

describe('detectPendingTurn', () => {
  it('returns invalid turn details with a normalized fingerprint', async () => {
    const result = await detectPendingTurn({
      analysis: createAnalysis('invalid', [], {
        violationReason: 'bad turn'
      }),
      messageId: 'assistant-1',
      messageText: '  bad turn\u00a0',
      executedCallIds: new Set(),
      executedBatchIds: new Set(),
      currentPendingCallIds: [],
      createCallId: async (raw) => raw,
      createBatchId: async () => 'unused'
    });

    expect(result).toEqual({
      status: 'invalid',
      messageId: 'assistant-1',
      invalidReason: 'bad turn',
      fingerprint: 'bad turn'
    });
  });

  it('returns a recoverable pending batch with stable batch metadata', async () => {
    const blocks: PendingTurnBlock[] = [
      {
        block: { tool: 'read_file', args: { path: 'SPEC.md' } },
        raw: '{"tool":"read_file","args":{"path":"SPEC.md"}}',
        callId: 'unused-1'
      },
      {
        block: { tool: 'grep_files', args: { query: 'Phase 2' } },
        raw: '{"tool":"grep_files","args":{"query":"Phase 2"}}',
        callId: 'unused-2'
      }
    ];

    const result = await detectPendingTurn({
      analysis: createAnalysis('recoverable', blocks, {
        warningReason: 'Recovered a valid MCP block from a mixed reply.'
      }),
      messageId: 'assistant-2',
      messageText: 'mixed',
      executedCallIds: new Set(),
      executedBatchIds: new Set(),
      currentPendingCallIds: [],
      createCallId: async (raw) => `call:${raw}`,
      createBatchId: async (messageId, next) => `batch:${messageId}:${next.length}`
    });

    expect(result).toMatchObject({
      status: 'pending',
      messageId: 'assistant-2',
      batchId: 'batch:assistant-2:2',
      warningReason: 'Recovered a valid MCP block from a mixed reply.'
    });
    if (!result || result.status !== 'pending') {
      throw new Error('expected pending result');
    }
    expect(result.next.map((item) => item.callId)).toEqual([
      `call:${blocks[0]?.raw}`,
      `call:${blocks[1]?.raw}`
    ]);
  });

  it('returns unchanged when the next selection matches the current pending call ids', async () => {
    const raw = '{"tool":"read_file","args":{"path":"SPEC.md"}}';
    const result = await detectPendingTurn({
      analysis: createAnalysis('valid', [
        {
          block: { tool: 'read_file', args: { path: 'SPEC.md' } },
          raw,
          callId: 'unused'
        }
      ]),
      messageId: 'assistant-3',
      messageText: raw,
      executedCallIds: new Set(),
      executedBatchIds: new Set(),
      currentPendingCallIds: [`call:${raw}`],
      createCallId: async (candidate) => `call:${candidate}`,
      createBatchId: async () => 'unused'
    });

    expect(result).toEqual({
      status: 'unchanged'
    });
  });
});
