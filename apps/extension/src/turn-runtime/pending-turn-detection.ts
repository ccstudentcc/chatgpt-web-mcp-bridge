import { getChatGptTurnId } from '../chatgpt-adapter/index.js';
import type { McpTurnAnalysis, ParsedMcpCandidate } from './mcp-turn-analysis.js';
import { isSamePendingSelection } from './pending-selection.js';

export interface PendingTurnDetectionIdentityContext {
  ephemeralMessageIds: WeakMap<HTMLElement, string>;
  nextEphemeralMessageId: number;
}

export interface PendingTurnBlock extends ParsedMcpCandidate {
  callId: string;
}

export type PendingTurnDetectionResult =
  | {
    status: 'pending';
    next: PendingTurnBlock[];
    messageId: string;
    batchId?: string;
  }
  | {
    status: 'pending';
    next: PendingTurnBlock[];
    messageId: string;
    batchId?: string;
    warningReason: string;
  }
  | {
    status: 'invalid';
    messageId: string;
    invalidReason: string;
    fingerprint: string;
  }
  | {
    status: 'unchanged';
  }
  | null;

export function getMessageIdentity(
  message: HTMLElement,
  messageText: string,
  context: PendingTurnDetectionIdentityContext
): {
  messageId: string;
  nextEphemeralMessageId: number;
} {
  const explicitId = getChatGptTurnId(message);
  if (explicitId) {
    return {
      messageId: explicitId,
      nextEphemeralMessageId: context.nextEphemeralMessageId
    };
  }

  let ephemeralId = context.ephemeralMessageIds.get(message);
  let nextEphemeralMessageId = context.nextEphemeralMessageId;
  if (!ephemeralId) {
    const textHint = messageText.trim().slice(0, 32);
    ephemeralId = `ephemeral-message-${nextEphemeralMessageId++}${textHint ? `:${textHint}` : ''}`;
    context.ephemeralMessageIds.set(message, ephemeralId);
  }
  return {
    messageId: ephemeralId,
    nextEphemeralMessageId
  };
}

export function trackMessageIdentity(
  message: HTMLElement,
  messageText: string,
  context: PendingTurnDetectionIdentityContext
): {
  messageId: string;
  nextState: PendingTurnDetectionIdentityContext;
} {
  const identity = getMessageIdentity(message, messageText, context);
  return {
    messageId: identity.messageId,
    nextState: {
      ephemeralMessageIds: context.ephemeralMessageIds,
      nextEphemeralMessageId: identity.nextEphemeralMessageId
    }
  };
}

export function normalizeDetectionFingerprint(value: string): string {
  return value.replace(/\u00a0/g, ' ').trim();
}

export async function detectPendingTurn({
  analysis,
  messageId,
  messageText,
  executedCallIds,
  executedBatchIds,
  currentPendingCallIds,
  currentPendingBatchId,
  createCallId,
  createBatchId
}: {
  analysis: McpTurnAnalysis;
  messageId: string;
  messageText: string;
  executedCallIds: ReadonlySet<string>;
  executedBatchIds: ReadonlySet<string>;
  currentPendingCallIds: string[];
  currentPendingBatchId?: string;
  createCallId: (raw: string) => Promise<string>;
  createBatchId: (messageId: string, blocks: Array<Pick<PendingTurnBlock, 'raw'>>) => Promise<string>;
}): Promise<PendingTurnDetectionResult> {
  if (analysis.status === 'invalid') {
    return {
      status: 'invalid',
      messageId,
      invalidReason: analysis.violationReason ?? 'Assistant reply contained an invalid MCP tool-call turn.',
      fingerprint: normalizeDetectionFingerprint(messageText)
    };
  }

  const normalizedBlocks = await Promise.all(analysis.blocks.map(async (item) => ({
    ...item,
    callId: await createCallId(item.raw)
  })));
  const next = normalizedBlocks.filter((item) => !executedCallIds.has(item.callId));
  if (next.length === 0) {
    return null;
  }

  const batchId = next.length > 1 ? await createBatchId(messageId, next) : undefined;
  if (batchId && executedBatchIds.has(batchId)) {
    return null;
  }
  if (isSamePendingSelection(currentPendingCallIds, currentPendingBatchId, next.map((item) => item.callId), batchId)) {
    return {
      status: 'unchanged'
    };
  }

  return analysis.status === 'recoverable'
    ? { status: 'pending', next, messageId, batchId, warningReason: analysis.warningReason ?? 'Recovered a valid MCP block from a mixed reply.' }
    : { status: 'pending', next, messageId, batchId };
}
