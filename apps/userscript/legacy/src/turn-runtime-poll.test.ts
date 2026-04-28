import { describe, expect, it } from 'vitest';
import { createAssistantTurnScanState } from '../../extension/src/turn-runtime/assistant-turn-scan.js';
import { pollLatestAssistantTurnRuntime } from '../../extension/src/turn-runtime/turn-runtime-poll.js';
import type { PendingTurnBlock } from '../../extension/src/turn-runtime/pending-turn-detection.js';

function createMessage(dataset: Record<string, string> = {}, id = ''): HTMLElement {
  return {
    dataset,
    id
  } as unknown as HTMLElement;
}

describe('pollLatestAssistantTurnRuntime', () => {
  it('collapses a missing assistant source into a clear reset decision', async () => {
    const result = await pollLatestAssistantTurnRuntime<'detected'>({
      findLatestUserMessage: () => null,
      findLatestOpenAssistantMessage: () => null,
      extractVisibleText: () => '',
      conversationPath: '/c/runtime-test',
      state: {
        ...createAssistantTurnScanState(),
        pendingInvalidTurn: {
          messageId: 'assistant-1',
          reason: 'bad turn',
          fingerprint: 'bad turn',
          firstSeenAt: 1_000
        }
      },
      executedCallIds: new Set(),
      executedBatchIds: new Set(),
      currentPendingCallIds: [],
      currentStatus: 'detected',
      hasRetryableBatch: false,
      createCallId: async (_messageId, raw) => raw,
      createBatchId: async () => 'unused',
      now: 5_000,
      invalidGraceMs: 2_000
    });

    expect(result).toEqual({
      status: 'clear',
      requestId: 'conversation:/c/runtime-test',
      nextState: {
        ephemeralMessageIds: result.nextState.ephemeralMessageIds,
        nextEphemeralMessageId: 1,
        pendingInvalidTurn: null
      },
      reset: {
        shouldClear: true,
        nextStatus: 'idle'
      }
    });
  });

  it('returns a ready pending update with the current request identity', async () => {
    const result = await pollLatestAssistantTurnRuntime<'idle'>({
      findLatestUserMessage: () => createMessage({ messageId: 'user-1' }),
      findLatestOpenAssistantMessage: () => createMessage({ messageId: 'assistant-7' }),
      extractVisibleText: (message) => message.dataset.messageId === 'user-1'
        ? 'read the current spec'
        : '```mcp\n{"tool":"read_file","args":{"path":"SPEC.md"}}\n```',
      conversationPath: '/c/runtime-test',
      state: createAssistantTurnScanState(),
      executedCallIds: new Set(),
      executedBatchIds: new Set(),
      currentPendingCallIds: [],
      currentStatus: 'idle',
      hasRetryableBatch: false,
      createCallId: async (messageId, raw) => `call:${messageId}:${raw}`,
      createBatchId: async () => 'unused',
      now: 5_000,
      invalidGraceMs: 2_000
    });

    expect(result.status).toBe('pending');
    if (result.status !== 'pending') {
      throw new Error('expected pending result');
    }

    expect(result.requestId).toBe('user-1');
    expect(result.update.pendingMessageId).toBe('assistant-7');
    expect(result.update.pendingRequestId).toBe('user-1');
    expect(result.update.pending.map((item) => item.callId)).toEqual([
      'call:assistant-7:{"tool":"read_file","args":{"path":"SPEC.md"}}'
    ]);
    expect(result.update.status).toBe('detected');
  });

  it('turns a stable invalid assistant reply into an invalid runtime update after grace', async () => {
    const assistantText = 'prefix\n```mcp\n{"tool":"read_file","args":{"path":"SPEC.md"}}\n```\nsuffix';
    const userMessage = createMessage();
    const assistantMessage = createMessage({ messageId: 'assistant-9' });
    const first = await pollLatestAssistantTurnRuntime<'idle'>({
      findLatestUserMessage: () => userMessage,
      findLatestOpenAssistantMessage: () => assistantMessage,
      extractVisibleText: (message) => message.dataset.messageId === 'assistant-9' ? assistantText : 'run the tool',
      conversationPath: '/c/runtime-test',
      state: createAssistantTurnScanState(),
      executedCallIds: new Set(),
      executedBatchIds: new Set(),
      currentPendingCallIds: [],
      currentStatus: 'idle',
      hasRetryableBatch: false,
      createCallId: async (messageId, raw) => `call:${messageId}:${raw}`,
      createBatchId: async () => 'unused',
      now: 1_000,
      invalidGraceMs: 2_000
    });

    expect(first.status).toBe('invalid_waiting');
    if (first.status !== 'invalid_waiting') {
      throw new Error('expected invalid_waiting result');
    }

    const result = await pollLatestAssistantTurnRuntime<'idle'>({
      findLatestUserMessage: () => userMessage,
      findLatestOpenAssistantMessage: () => assistantMessage,
      extractVisibleText: (message) => message.dataset.messageId === 'assistant-9' ? assistantText : 'run the tool',
      conversationPath: '/c/runtime-test',
      state: first.nextState,
      executedCallIds: new Set(),
      executedBatchIds: new Set(),
      currentPendingCallIds: [],
      currentStatus: 'idle',
      hasRetryableBatch: false,
      lastInvalidMcpMessageId: 'assistant-8',
      lastError: 'old error',
      createCallId: async (messageId, raw) => `call:${messageId}:${raw}`,
      createBatchId: async () => 'unused',
      now: 3_500,
      invalidGraceMs: 2_000
    });

    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') {
      throw new Error('expected invalid result');
    }

    expect(result.requestId).toContain('ephemeral-message-1');
    expect(result.invalidReason).toContain('after MCP tool-call blocks');
    expect(result.update.status).toBe('invalid_mcp_turn');
    expect(result.update.isNewInvalidTurn).toBe(true);
    expect(result.update.lastInvalidMcpMessageId).toBe('assistant-9');
  });
});
