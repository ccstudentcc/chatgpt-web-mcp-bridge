import { getPendingTurnRuntimeStatus, type PendingTurnRuntimeStatus } from './pending-turn-runtime.js';

export interface PendingSelectionRuntimeUpdate<TBlock> {
  pending: TBlock[];
  pendingBatchId?: undefined;
  pendingMessageId?: undefined;
  pendingRequestId?: undefined;
}

export interface ConsumedPendingRuntimeUpdate<TBlock> extends PendingSelectionRuntimeUpdate<TBlock> {
  executedCallId?: string;
}

export interface IgnoredPendingRuntimeUpdate<TBlock> extends PendingSelectionRuntimeUpdate<TBlock> {
  ignoredKind: 'none' | 'single' | 'batch';
  ignoredTool?: string;
  executedCallIds: string[];
  executedBatchId?: string;
  status: PendingTurnRuntimeStatus;
}

export function clearPendingSelectionRuntime<TBlock>(): PendingSelectionRuntimeUpdate<TBlock> {
  return {
    pending: [] as TBlock[],
    pendingBatchId: undefined,
    pendingMessageId: undefined,
    pendingRequestId: undefined
  };
}

export function consumeFirstPendingRuntime<TBlock extends { callId: string }>(
  pending: TBlock[]
): ConsumedPendingRuntimeUpdate<TBlock> {
  const [first, ...rest] = pending;
  return {
    ...clearPendingSelectionRuntime<TBlock>(),
    pending: rest,
    executedCallId: first?.callId
  };
}

export function createIgnoredPendingRuntimeUpdate<
  TBlock extends { callId: string; block: { tool: string } }
>({
  pending,
  pendingBatchId
}: {
  pending: TBlock[];
  pendingBatchId?: string;
}): IgnoredPendingRuntimeUpdate<TBlock> {
  if (pending.length === 0) {
    return {
      ...clearPendingSelectionRuntime<TBlock>(),
      ignoredKind: 'none',
      executedCallIds: [],
      status: 'idle'
    };
  }

  if (pending.length > 1 && pendingBatchId) {
    return {
      ...clearPendingSelectionRuntime<TBlock>(),
      ignoredKind: 'batch',
      executedCallIds: pending.map((item) => item.callId),
      executedBatchId: pendingBatchId,
      status: 'idle'
    };
  }

  const [first, ...rest] = pending;
  return {
    ...clearPendingSelectionRuntime<TBlock>(),
    pending: rest,
    ignoredKind: first ? 'single' : 'none',
    ignoredTool: first?.block.tool,
    executedCallIds: first ? [first.callId] : [],
    status: getPendingTurnRuntimeStatus(rest.length, undefined)
  };
}
