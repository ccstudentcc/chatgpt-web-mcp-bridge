import {
  scanAssistantTurn,
  type AssistantTurnScanResult,
  type AssistantTurnScanState
} from './assistant-turn-scan.js';
import { analyzeMcpTurn, type McpTurnAnalysis } from './mcp-turn-analysis.js';
import { type PendingTurnBlock, trackMessageIdentity } from './pending-turn-detection.js';

export interface TurnRuntimeMessageSource {
  message: HTMLElement;
  messageText: string;
}

export interface CurrentRequestIdentityResult {
  requestId: string;
  nextState: AssistantTurnScanState;
}

export type LatestAssistantTurnSourceResult =
  | {
    status: 'missing';
    nextState: AssistantTurnScanState;
  }
  | AssistantTurnScanResult;

export function resolveCurrentRequestIdentity({
  findLatestUserMessage,
  extractVisibleText,
  conversationPath,
  state
}: {
  findLatestUserMessage: () => HTMLElement | null;
  extractVisibleText: (message: HTMLElement) => string;
  conversationPath: string;
  state: AssistantTurnScanState;
}): CurrentRequestIdentityResult {
  const message = findLatestUserMessage();
  if (!message) {
    return {
      requestId: `conversation:${conversationPath}`,
      nextState: state
    };
  }

  const identity = trackMessageIdentity(message, extractVisibleText(message), state);
  return {
    requestId: identity.messageId,
    nextState: {
      ...state,
      ephemeralMessageIds: identity.nextState.ephemeralMessageIds,
      nextEphemeralMessageId: identity.nextState.nextEphemeralMessageId
    }
  };
}

export function resolveLatestAssistantTurnSource({
  findLatestOpenAssistantMessage,
  extractVisibleText
}: {
  findLatestOpenAssistantMessage: () => HTMLElement | null;
  extractVisibleText: (message: HTMLElement) => string;
}): TurnRuntimeMessageSource | null {
  const message = findLatestOpenAssistantMessage();
  if (!message) {
    return null;
  }

  return {
    message,
    messageText: extractVisibleText(message)
  };
}

export async function scanLatestAssistantTurnSource({
  findLatestOpenAssistantMessage,
  extractVisibleText,
  analyzeTurn = analyzeMcpTurn,
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
  findLatestOpenAssistantMessage: () => HTMLElement | null;
  extractVisibleText: (message: HTMLElement) => string;
  analyzeTurn?: (container: ParentNode, visibleText: string) => Promise<McpTurnAnalysis>;
  state: AssistantTurnScanState;
  executedCallIds: ReadonlySet<string>;
  executedBatchIds: ReadonlySet<string>;
  currentPendingCallIds: string[];
  currentPendingBatchId?: string;
  createCallId: (messageId: string, raw: string) => Promise<string>;
  createBatchId: (messageId: string, blocks: Array<Pick<PendingTurnBlock, 'raw'>>) => Promise<string>;
  now: number;
  invalidGraceMs: number;
}): Promise<LatestAssistantTurnSourceResult> {
  const source = resolveLatestAssistantTurnSource({
    findLatestOpenAssistantMessage,
    extractVisibleText
  });
  if (!source) {
    return {
      status: 'missing',
      nextState: {
        ...state,
        pendingInvalidTurn: null
      }
    };
  }

  const analysis = await analyzeTurn(source.message, source.messageText);
  return scanAssistantTurn({
    message: source.message,
    messageText: source.messageText,
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
  });
}
