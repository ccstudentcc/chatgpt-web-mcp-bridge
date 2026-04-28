import type { ParsedMcpBlock } from './parser.js';
import {
  isSamePendingSelection as isSamePendingSelectionByCallIds,
  updatePendingInvalidTurn,
  type InvalidTurnCandidate,
  type PendingInvalidTurnState
} from './turn-runtime.js';

export { updatePendingInvalidTurn } from './turn-runtime.js';
export type { InvalidTurnCandidate, PendingInvalidTurnState } from './turn-runtime.js';

export function isSamePendingSelection(
  currentPending: ParsedMcpBlock[],
  currentBatchId: string | undefined,
  nextPending: ParsedMcpBlock[],
  nextBatchId: string | undefined
): boolean {
  return isSamePendingSelectionByCallIds(
    currentPending.map((item) => item.callId),
    currentBatchId,
    nextPending.map((item) => item.callId),
    nextBatchId
  );
}
