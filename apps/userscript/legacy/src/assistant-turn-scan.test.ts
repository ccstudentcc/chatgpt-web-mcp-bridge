import { describe, expect, it } from 'vitest';
import {
  createAssistantTurnScanState,
  scanAssistantTurn
} from '../../extension/src/turn-runtime/assistant-turn-scan.js';
import type { McpTurnAnalysis } from '../../extension/src/turn-runtime/mcp-turn-analysis.js';

function createAnalysis(
  status: McpTurnAnalysis['status'],
  extra: Partial<McpTurnAnalysis> = {}
): McpTurnAnalysis {
  return {
    status,
    blocks: [],
    errors: [],
    ...extra
  };
}

describe('scanAssistantTurn', () => {
  it('assigns pending work an ephemeral message id and clears invalid grace state', async () => {
    const result = await scanAssistantTurn({
      message: {
        dataset: {},
        id: ''
      } as unknown as HTMLElement,
      messageText: '```mcp\n{"tool":"read_file","args":{"path":"SPEC.md"}}\n```',
      analysis: createAnalysis('valid', {
        blocks: [
          {
            block: { tool: 'read_file', args: { path: 'SPEC.md' } },
            raw: '{"tool":"read_file","args":{"path":"SPEC.md"}}'
          }
        ]
      }),
      state: {
        ...createAssistantTurnScanState(),
        pendingInvalidTurn: {
          messageId: 'stale-invalid',
          reason: 'stale reason',
          fingerprint: 'stale fingerprint',
          firstSeenAt: 10
        }
      },
      executedCallIds: new Set(),
      executedBatchIds: new Set(),
      currentPendingCallIds: [],
      createCallId: async (_messageId, raw) => `call:${raw}`,
      createBatchId: async () => 'unused',
      now: 1_000,
      invalidGraceMs: 2_000
    });

    expect(result.status).toBe('pending');
    if (result.status !== 'pending') {
      throw new Error('expected pending result');
    }

    expect(result.messageId).toContain('ephemeral-message-1');
    expect(result.next.map((item) => item.callId)).toEqual([
      'call:{"tool":"read_file","args":{"path":"SPEC.md"}}'
    ]);
    expect(result.nextState.nextEphemeralMessageId).toBe(2);
    expect(result.nextState.pendingInvalidTurn).toBeNull();
  });

  it('holds invalid turns during the grace window before blocking them', async () => {
    const message = {
      dataset: {
        messageId: 'assistant-1'
      },
      id: ''
    } as unknown as HTMLElement;

    const first = await scanAssistantTurn({
      message,
      messageText: 'bad turn',
      analysis: createAnalysis('invalid', {
        violationReason: 'invalid mcp'
      }),
      state: createAssistantTurnScanState(),
      executedCallIds: new Set(),
      executedBatchIds: new Set(),
      currentPendingCallIds: [],
      createCallId: async (_messageId, raw) => raw,
      createBatchId: async () => 'unused',
      now: 1_000,
      invalidGraceMs: 2_000
    });

    expect(first.status).toBe('invalid_waiting');
    if (first.status !== 'invalid_waiting') {
      throw new Error('expected invalid_waiting result');
    }

    const second = await scanAssistantTurn({
      message,
      messageText: 'bad turn',
      analysis: createAnalysis('invalid', {
        violationReason: 'invalid mcp'
      }),
      state: first.nextState,
      executedCallIds: new Set(),
      executedBatchIds: new Set(),
      currentPendingCallIds: [],
      createCallId: async (_messageId, raw) => raw,
      createBatchId: async () => 'unused',
      now: 3_000,
      invalidGraceMs: 2_000
    });

    expect(second.status).toBe('invalid');
    if (second.status !== 'invalid') {
      throw new Error('expected invalid result');
    }

    expect(second.messageId).toBe('assistant-1');
    expect(second.invalidReason).toBe('invalid mcp');
    expect(second.nextState.pendingInvalidTurn?.messageId).toBe('assistant-1');
  });

  it('returns clear when the latest assistant turn no longer has pending work', async () => {
    const result = await scanAssistantTurn({
      message: {
        dataset: {
          messageId: 'assistant-2'
        },
        id: ''
      } as unknown as HTMLElement,
      messageText: 'summary only',
      analysis: createAnalysis('none'),
      state: {
        ...createAssistantTurnScanState(),
        pendingInvalidTurn: {
          messageId: 'assistant-1',
          reason: 'invalid mcp',
          fingerprint: 'bad turn',
          firstSeenAt: 1_000
        }
      },
      executedCallIds: new Set(),
      executedBatchIds: new Set(),
      currentPendingCallIds: ['call:old'],
      currentPendingBatchId: 'batch:old',
      createCallId: async (_messageId, raw) => raw,
      createBatchId: async () => 'unused',
      now: 4_000,
      invalidGraceMs: 2_000
    });

    expect(result.status).toBe('clear');
    if (result.status !== 'clear') {
      throw new Error('expected clear result');
    }

    expect(result.nextState.nextEphemeralMessageId).toBe(1);
    expect(result.nextState.pendingInvalidTurn).toBeNull();
  });
});
