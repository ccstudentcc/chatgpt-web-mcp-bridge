export {
  canAutoRunForRequest,
  recordAutoRunForRequest,
  syncAutoRoundRequest,
  type AutoRoundGuardState
} from '../../extension/src/turn-runtime/auto-round-guard.js';
export {
  updatePendingInvalidTurn,
  type InvalidTurnCandidate,
  type PendingInvalidTurnState
} from '../../extension/src/turn-runtime/invalid-turn-state.js';
export {
  isSamePendingSelection
} from '../../extension/src/turn-runtime/pending-selection.js';
