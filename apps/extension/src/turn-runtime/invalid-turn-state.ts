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
