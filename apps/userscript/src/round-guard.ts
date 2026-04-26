export interface AutoRoundGuardState {
  requestId?: string;
  count: number;
  maxToolRounds: number;
}

export function syncAutoRoundRequest(state: AutoRoundGuardState, requestId: string): AutoRoundGuardState {
  if (state.requestId === requestId) {
    return state;
  }

  return {
    ...state,
    requestId,
    count: 0
  };
}

export function canAutoRunForRequest(state: AutoRoundGuardState, requestId: string): boolean {
  const synced = syncAutoRoundRequest(state, requestId);
  return synced.maxToolRounds <= 0 || synced.count < synced.maxToolRounds;
}

export function recordAutoRunForRequest(state: AutoRoundGuardState, requestId: string): AutoRoundGuardState {
  const synced = syncAutoRoundRequest(state, requestId);
  return {
    ...synced,
    count: synced.count + 1
  };
}
