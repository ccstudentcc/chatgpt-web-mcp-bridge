import type { ParsedMcpBlock } from './parser.js';

export interface PendingInvalidTurnState {
  messageId: string;
  reason: string;
  fingerprint: string;
  firstSeenAt: number;
}

export interface InvalidTurnCandidate {
  messageId: string;
  reason: string;
  fingerprint: string;
}

export function isSamePendingSelection(
  currentPending: ParsedMcpBlock[],
  currentBatchId: string | undefined,
  nextPending: ParsedMcpBlock[],
  nextBatchId: string | undefined
): boolean {
  if (nextPending.length !== currentPending.length) {
    return false;
  }
  if (nextBatchId !== currentBatchId) {
    return false;
  }

  return nextPending.every((item, index) => item.callId === currentPending[index]?.callId);
}

export function updatePendingInvalidTurn(
  current: PendingInvalidTurnState | null,
  candidate: InvalidTurnCandidate,
  now: number,
  graceMs: number
): { next: PendingInvalidTurnState; shouldBlock: boolean } {
  if (
    !current
    || current.messageId !== candidate.messageId
    || current.reason !== candidate.reason
    || current.fingerprint !== candidate.fingerprint
  ) {
    return {
      next: {
        ...candidate,
        firstSeenAt: now
      },
      shouldBlock: false
    };
  }

  return {
    next: current,
    shouldBlock: now - current.firstSeenAt >= graceMs
  };
}
