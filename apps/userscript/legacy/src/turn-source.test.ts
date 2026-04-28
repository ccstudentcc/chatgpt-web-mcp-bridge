import { describe, expect, it } from 'vitest';
import { createAssistantTurnScanState } from '../../extension/src/turn-runtime/assistant-turn-scan.js';
import {
  resolveCurrentRequestIdentity,
  resolveLatestAssistantTurnSource,
  scanLatestAssistantTurnSource
} from '../../extension/src/turn-runtime/turn-source.js';
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

describe('turn source helpers', () => {
  it('falls back to the conversation path when no user turn exists', () => {
    const state = createAssistantTurnScanState();

    const result = resolveCurrentRequestIdentity({
      findLatestUserMessage: () => null,
      extractVisibleText: () => '',
      conversationPath: '/c/test-conversation',
      state
    });

    expect(result.requestId).toBe('conversation:/c/test-conversation');
    expect(result.nextState).toBe(state);
  });

  it('tracks a user turn identity without dropping invalid-turn grace state', () => {
    const state = {
      ...createAssistantTurnScanState(),
      pendingInvalidTurn: {
        messageId: 'assistant-1',
        reason: 'bad turn',
        fingerprint: 'bad turn',
        firstSeenAt: 10
      }
    };
    const message = {
      dataset: {},
      id: ''
    } as unknown as HTMLElement;

    const result = resolveCurrentRequestIdentity({
      findLatestUserMessage: () => message,
      extractVisibleText: () => 'continue the request',
      conversationPath: '/c/test-conversation',
      state
    });

    expect(result.requestId).toContain('ephemeral-message-1');
    expect(result.nextState.nextEphemeralMessageId).toBe(2);
    expect(result.nextState.pendingInvalidTurn).toEqual(state.pendingInvalidTurn);
  });

  it('returns null when no assistant source is discoverable', () => {
    expect(resolveLatestAssistantTurnSource({
      findLatestOpenAssistantMessage: () => null,
      extractVisibleText: () => ''
    })).toBeNull();
  });

  it('clears pending invalid grace state when no assistant turn is available', async () => {
    const result = await scanLatestAssistantTurnSource({
      findLatestOpenAssistantMessage: () => null,
      extractVisibleText: () => '',
      state: {
        ...createAssistantTurnScanState(),
        pendingInvalidTurn: {
          messageId: 'assistant-1',
          reason: 'bad turn',
          fingerprint: 'bad turn',
          firstSeenAt: 100
        }
      },
      executedCallIds: new Set(),
      executedBatchIds: new Set(),
      currentPendingCallIds: [],
      createCallId: async (_messageId, raw) => raw,
      createBatchId: async () => 'unused',
      now: 1_000,
      invalidGraceMs: 2_000
    });

    expect(result).toEqual({
      status: 'missing',
      nextState: {
        ephemeralMessageIds: result.nextState.ephemeralMessageIds,
        nextEphemeralMessageId: 1,
        pendingInvalidTurn: null
      }
    });
  });

  it('scans the latest assistant source through the shared turn-runtime pipeline', async () => {
    const message = {
      dataset: {
        messageId: 'assistant-7'
      },
      id: ''
    } as unknown as HTMLElement;

    const result = await scanLatestAssistantTurnSource({
      findLatestOpenAssistantMessage: () => message,
      extractVisibleText: () => '```mcp\n{"tool":"read_file","args":{"path":"SPEC.md"}}\n```',
      analyzeTurn: async () => createAnalysis('valid', {
        blocks: [
          {
            block: { tool: 'read_file', args: { path: 'SPEC.md' } },
            raw: '{"tool":"read_file","args":{"path":"SPEC.md"}}'
          }
        ]
      }),
      state: createAssistantTurnScanState(),
      executedCallIds: new Set(),
      executedBatchIds: new Set(),
      currentPendingCallIds: [],
      createCallId: async (messageId, raw) => `call:${messageId}:${raw}`,
      createBatchId: async () => 'unused',
      now: 1_000,
      invalidGraceMs: 2_000
    });

    expect(result.status).toBe('pending');
    if (result.status !== 'pending') {
      throw new Error('expected pending result');
    }

    expect(result.messageId).toBe('assistant-7');
    expect(result.next.map((item) => item.callId)).toEqual([
      'call:assistant-7:{"tool":"read_file","args":{"path":"SPEC.md"}}'
    ]);
    expect(result.nextState.pendingInvalidTurn).toBeNull();
  });
});
