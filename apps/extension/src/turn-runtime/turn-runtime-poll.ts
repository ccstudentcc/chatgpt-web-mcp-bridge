import type { AssistantTurnScanState } from './assistant-turn-scan.js';
import {
  createInvalidTurnRuntimeUpdate,
  createPendingDetectionUpdate,
  resetPendingDetectionRuntime,
  type InvalidTurnRuntimeUpdate,
  type PendingDetectionUpdate
} from './scan-runtime-effects.js';
import { resolveCurrentRequestIdentity, scanLatestAssistantTurnSource } from './turn-source.js';
import type { PendingTurnBlock } from './pending-turn-detection.js';

export type TurnRuntimePollResult<TStatus extends string> =
  | {
    status: 'clear';
    requestId: string;
    nextState: AssistantTurnScanState;
    reset: {
      shouldClear: boolean;
      nextStatus: TStatus | 'idle';
    };
  }
  | {
    status: 'unchanged';
    requestId: string;
    nextState: AssistantTurnScanState;
  }
  | {
    status: 'pending';
    requestId: string;
    nextState: AssistantTurnScanState;
    update: PendingDetectionUpdate<PendingTurnBlock>;
    warningReason?: string;
    batchId?: string;
  }
  | {
    status: 'invalid_waiting';
    requestId: string;
    nextState: AssistantTurnScanState;
  }
  | {
    status: 'invalid';
    requestId: string;
    nextState: AssistantTurnScanState;
    update: InvalidTurnRuntimeUpdate;
    invalidReason: string;
  };

export async function pollLatestAssistantTurnRuntime<TStatus extends string>({
  findLatestUserMessage,
  findLatestOpenAssistantMessage,
  extractVisibleText,
  conversationPath,
  state,
  executedCallIds,
  executedBatchIds,
  currentPendingCallIds,
  currentPendingBatchId,
  currentStatus,
  hasRetryableBatch,
  lastInvalidMcpMessageId,
  lastError,
  createCallId,
  createBatchId,
  now,
  invalidGraceMs
}: {
  findLatestUserMessage: () => HTMLElement | null;
  findLatestOpenAssistantMessage: () => HTMLElement | null;
  extractVisibleText: (message: HTMLElement) => string;
  conversationPath: string;
  state: AssistantTurnScanState;
  executedCallIds: ReadonlySet<string>;
  executedBatchIds: ReadonlySet<string>;
  currentPendingCallIds: string[];
  currentPendingBatchId?: string;
  currentStatus: TStatus;
  hasRetryableBatch: boolean;
  lastInvalidMcpMessageId?: string;
  lastError?: string;
  createCallId: (messageId: string, raw: string) => Promise<string>;
  createBatchId: (messageId: string, blocks: Array<Pick<PendingTurnBlock, 'raw'>>) => Promise<string>;
  now: number;
  invalidGraceMs: number;
}): Promise<TurnRuntimePollResult<TStatus>> {
  const requestIdentity = resolveCurrentRequestIdentity({
    findLatestUserMessage,
    extractVisibleText,
    conversationPath,
    state
  });
  const requestId = requestIdentity.requestId;

  const detection = await scanLatestAssistantTurnSource({
    findLatestOpenAssistantMessage,
    extractVisibleText,
    state: requestIdentity.nextState,
    executedCallIds,
    executedBatchIds,
    currentPendingCallIds,
    currentPendingBatchId,
    createCallId,
    createBatchId,
    now,
    invalidGraceMs
  });

  if (detection.status === 'missing' || detection.status === 'clear') {
    return {
      status: 'clear',
      requestId,
      nextState: detection.nextState,
      reset: resetPendingDetectionRuntime({
        status: currentStatus,
        hasRetryableBatch
      })
    };
  }

  if (detection.status === 'unchanged') {
    return {
      status: 'unchanged',
      requestId,
      nextState: detection.nextState
    };
  }

  if (detection.status === 'pending') {
    return {
      status: 'pending',
      requestId,
      nextState: detection.nextState,
      update: createPendingDetectionUpdate({
        pending: detection.next,
        messageId: detection.messageId,
        batchId: detection.batchId,
        requestId
      }),
      warningReason: 'warningReason' in detection ? detection.warningReason : undefined,
      batchId: detection.batchId
    };
  }

  if (detection.status === 'invalid_waiting') {
    return {
      status: 'invalid_waiting',
      requestId,
      nextState: detection.nextState
    };
  }

  return {
    status: 'invalid',
    requestId,
    nextState: detection.nextState,
    update: createInvalidTurnRuntimeUpdate({
      lastInvalidMcpMessageId,
      lastError,
      messageId: detection.messageId,
      invalidReason: detection.invalidReason
    }),
    invalidReason: detection.invalidReason
  };
}
