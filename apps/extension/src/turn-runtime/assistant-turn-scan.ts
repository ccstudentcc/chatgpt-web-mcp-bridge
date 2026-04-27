import type { McpTurnAnalysis } from './mcp-turn-analysis.js';
import {
  detectPendingTurn,
  getMessageIdentity,
  type PendingTurnBlock,
  type PendingTurnDetectionResult,
  type PendingTurnDetectionIdentityContext
} from './pending-turn-detection.js';
import { updatePendingInvalidTurn, type PendingInvalidTurnState } from './invalid-turn-state.js';

export interface AssistantTurnScanState extends PendingTurnDetectionIdentityContext {
  pendingInvalidTurn: PendingInvalidTurnState | null;
}

export type AssistantTurnScanResult =
  | {
    status: 'clear';
    nextState: AssistantTurnScanState;
  }
  | {
    status: 'unchanged';
    nextState: AssistantTurnScanState;
  }
  | ({
    status: 'pending';
    nextState: AssistantTurnScanState;
  } & Extract<PendingTurnDetectionResult, { status: 'pending' }>)
  | {
    status: 'invalid_waiting';
    nextState: AssistantTurnScanState;
    messageId: string;
    invalidReason: string;
  }
  | {
    status: 'invalid';
    nextState: AssistantTurnScanState;
    messageId: string;
    invalidReason: string;
  };

export function createAssistantTurnScanState(): AssistantTurnScanState {
  return {
    ephemeralMessageIds: new WeakMap(),
    nextEphemeralMessageId: 1,
    pendingInvalidTurn: null
  };
}

export async function scanAssistantTurn({
  message,
  messageText,
  analysis,
  state,
  executedCallIds,
  executedBatchIds,
  currentPendingCallIds,
  currentPendingBatchId,
  createCallId,
  createBatchId,
  now,
  invalidGraceMs
}: {
  message: HTMLElement;
  messageText: string;
  analysis: McpTurnAnalysis;
  state: AssistantTurnScanState;
  executedCallIds: ReadonlySet<string>;
  executedBatchIds: ReadonlySet<string>;
  currentPendingCallIds: string[];
  currentPendingBatchId?: string;
  createCallId: (messageId: string, raw: string) => Promise<string>;
  createBatchId: (messageId: string, blocks: Array<Pick<PendingTurnBlock, 'raw'>>) => Promise<string>;
  now: number;
  invalidGraceMs: number;
}): Promise<AssistantTurnScanResult> {
  const identity = getMessageIdentity(message, messageText, state);
  const nextStateBase: AssistantTurnScanState = {
    ephemeralMessageIds: state.ephemeralMessageIds,
    nextEphemeralMessageId: identity.nextEphemeralMessageId,
    pendingInvalidTurn: null
  };

  const detection = await detectPendingTurn({
    analysis,
    messageId: identity.messageId,
    messageText,
    executedCallIds,
    executedBatchIds,
    currentPendingCallIds,
    currentPendingBatchId,
    createCallId: (raw) => createCallId(identity.messageId, raw),
    createBatchId
  });

  if (!detection) {
    return {
      status: 'clear',
      nextState: nextStateBase
    };
  }

  if (detection.status === 'unchanged') {
    return {
      status: 'unchanged',
      nextState: nextStateBase
    };
  }

  if (detection.status === 'pending') {
    return {
      ...detection,
      status: 'pending',
      nextState: nextStateBase
    };
  }

  const invalidTurnState = updatePendingInvalidTurn(
    state.pendingInvalidTurn,
    {
      messageId: detection.messageId,
      reason: detection.invalidReason,
      fingerprint: detection.fingerprint
    },
    now,
    invalidGraceMs
  );
  const nextState: AssistantTurnScanState = {
    ...nextStateBase,
    pendingInvalidTurn: invalidTurnState.next
  };

  if (!invalidTurnState.shouldBlock) {
    return {
      status: 'invalid_waiting',
      nextState,
      messageId: detection.messageId,
      invalidReason: detection.invalidReason
    };
  }

  return {
    status: 'invalid',
    nextState,
    messageId: detection.messageId,
    invalidReason: detection.invalidReason
  };
}
