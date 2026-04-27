export type DeliveryKind = 'single' | 'batch';
export type DeliveryPhase = 'ready' | 'inserted' | 'sent';
export type DeliveryRecoveryKind =
  | 'clipboard_fallback'
  | 'send_button_missing'
  | 'submission_not_confirmed';

export interface DeliveryLogEvent {
  level: 'success' | 'warn';
  message: string;
}

export interface DeliveryRecoveryNotice {
  kind: DeliveryRecoveryKind;
  message: string;
}

export interface DeliverResultOptions {
  kind: DeliveryKind;
  payload: string;
  autoSend: boolean;
  allowReuseCurrentComposer?: boolean;
  existingError?: string;
  preservedDraft?: string;
  insert: (value: string) => boolean;
  restore: (value: string) => boolean;
  send: () => Promise<boolean>;
  isSubmitting?: () => boolean;
  readCurrentInput: () => string;
  wait: (ms: number) => Promise<void>;
  now?: () => number;
  insertionSettleTimeoutMs?: number;
  submissionTimeoutMs?: number;
  pollIntervalMs?: number;
}

export interface DeliverResultOutcome {
  phase: DeliveryPhase;
  nextError?: string;
  nextPreservedDraft?: string;
  events: DeliveryLogEvent[];
  recovery?: DeliveryRecoveryNotice;
}

export async function deliverResult(options: DeliverResultOptions): Promise<DeliverResultOutcome> {
  const {
    kind,
    payload,
    autoSend,
    allowReuseCurrentComposer = false,
    existingError,
    preservedDraft,
    insert,
    restore,
    send,
    isSubmitting,
    readCurrentInput,
    wait,
    now = Date.now,
    insertionSettleTimeoutMs = 300,
    submissionTimeoutMs = 3_000,
    pollIntervalMs = 100
  } = options;
  const messages = getDeliveryMessages(kind);
  const nextPreservedDraft = resolvePreservedDraft({
    draft: preservedDraft ?? readCurrentInput(),
    payload
  });
  const currentComposerText = readCurrentInput();
  const canReuseCurrentComposer = allowReuseCurrentComposer
    && matchesAuthoritativeComposerState({
      currentText: currentComposerText,
      payload
    });

  if (!canReuseCurrentComposer && !insert(payload)) {
    return {
      phase: 'ready',
      nextError: existingError ?? messages.clipboardFallbackError,
      nextPreservedDraft,
      events: [{ level: 'warn', message: messages.clipboardFallbackLog }],
      recovery: {
        kind: 'clipboard_fallback',
        message: messages.clipboardFallbackRecovery
      }
    };
  }

  const events: DeliveryLogEvent[] = canReuseCurrentComposer
    ? []
    : [{ level: 'success', message: messages.insertedLog }];
  const insertedComposerText = canReuseCurrentComposer
    ? currentComposerText
    : readCurrentInput() || payload;
  if (!autoSend) {
    return {
      phase: 'inserted',
      nextError: existingError,
      nextPreservedDraft,
      events
    };
  }

  const insertionSettled = await waitForInsertedComposer({
    expectedText: insertedComposerText,
    readCurrentInput,
    wait,
    now,
    timeoutMs: insertionSettleTimeoutMs,
    pollIntervalMs
  });
  if (!insertionSettled) {
    const deliveryError = messages.notSubmittedError;
    events.push({ level: 'warn', message: deliveryError });
    return {
      phase: 'inserted',
      nextError: existingError ?? deliveryError,
      nextPreservedDraft,
      events,
      recovery: {
        kind: 'submission_not_confirmed',
        message: messages.notSubmittedRecovery
      }
    };
  }

  const wasSubmittingBeforeSend = isSubmitting?.() ?? false;
  const sent = await send();
  const confirmed = sent
    ? await waitForSubmittedComposer({
      expectedText: insertedComposerText,
      isSubmitting,
      requireSubmittingTransition: !wasSubmittingBeforeSend,
      readCurrentInput,
      wait,
      now,
      submissionTimeoutMs,
      pollIntervalMs
    })
    : false;

  if (sent && confirmed) {
    if (nextPreservedDraft) {
      restore(nextPreservedDraft);
    }
    events.push({ level: 'success', message: messages.sentLog });
    return {
      phase: 'sent',
      nextError: existingError,
      nextPreservedDraft: undefined,
      events
    };
  }

  const deliveryError = sent ? messages.notSubmittedError : messages.sendButtonMissingError;
  events.push({ level: 'warn', message: deliveryError });
  return {
    phase: 'inserted',
    nextError: existingError ?? deliveryError,
    nextPreservedDraft,
    events,
    recovery: {
      kind: sent ? 'submission_not_confirmed' : 'send_button_missing',
      message: sent ? messages.notSubmittedRecovery : messages.sendButtonMissingRecovery
    }
  };
}

function getDeliveryMessages(kind: DeliveryKind): {
  insertedLog: string;
  sentLog: string;
  clipboardFallbackError: string;
  clipboardFallbackLog: string;
  clipboardFallbackRecovery: string;
  sendButtonMissingError: string;
  sendButtonMissingRecovery: string;
  notSubmittedError: string;
  notSubmittedRecovery: string;
} {
  if (kind === 'batch') {
    return {
      insertedLog: 'Inserted batch result into ChatGPT composer.',
      sentLog: 'Sent batch result back to ChatGPT.',
      clipboardFallbackError: 'Chat input not found. Result copied to clipboard fallback.',
      clipboardFallbackLog: 'Could not find chat input. Result copied to clipboard fallback.',
      clipboardFallbackRecovery: 'Batch result was preserved in the clipboard. Use Insert result to retry after the chat composer is available again.',
      sendButtonMissingError: 'Batch result inserted, but the send button was not found.',
      sendButtonMissingRecovery: 'Batch result is still preserved in the ChatGPT composer. Review it there and send it manually, or copy it again from the panel.',
      notSubmittedError: 'Batch result was inserted and the send button was clicked, but ChatGPT did not submit the composer.',
      notSubmittedRecovery: 'Batch result stayed in the ChatGPT composer after the send attempt. Review it there and send it manually, or copy it again from the panel.'
    };
  }

  return {
    insertedLog: 'Inserted result into ChatGPT composer.',
    sentLog: 'Sent result back to ChatGPT.',
    clipboardFallbackError: 'Chat input not found. Result copied to clipboard fallback.',
    clipboardFallbackLog: 'Could not find chat input. Result copied to clipboard fallback.',
    clipboardFallbackRecovery: 'Tool result was preserved in the clipboard. Use Insert result to retry after the chat composer is available again.',
    sendButtonMissingError: 'Tool result inserted, but the send button was not found.',
    sendButtonMissingRecovery: 'Tool result is still preserved in the ChatGPT composer. Review it there and send it manually, or copy it again from the panel.',
    notSubmittedError: 'Tool result was inserted and the send button was clicked, but ChatGPT did not submit the composer.',
    notSubmittedRecovery: 'Tool result stayed in the ChatGPT composer after the send attempt. Review it there and send it manually, or copy it again from the panel.'
  };
}

async function waitForSubmittedComposer({
  expectedText,
  isSubmitting,
  requireSubmittingTransition,
  readCurrentInput,
  wait,
  now,
  submissionTimeoutMs,
  pollIntervalMs
}: {
  expectedText: string;
  isSubmitting?: () => boolean;
  requireSubmittingTransition: boolean;
  readCurrentInput: () => string;
  wait: (ms: number) => Promise<void>;
  now: () => number;
  submissionTimeoutMs: number;
  pollIntervalMs: number;
}): Promise<boolean> {
  const deadline = now() + submissionTimeoutMs;

  while (now() < deadline) {
    if (isSubmitting?.() && requireSubmittingTransition) {
      return true;
    }

    const current = normalizeComposerText(readCurrentInput());
    if (!current) {
      return true;
    }

    await wait(pollIntervalMs);
  }

  return false;
}

async function waitForInsertedComposer({
  expectedText,
  readCurrentInput,
  wait,
  now,
  timeoutMs,
  pollIntervalMs
}: {
  expectedText: string;
  readCurrentInput: () => string;
  wait: (ms: number) => Promise<void>;
  now: () => number;
  timeoutMs: number;
  pollIntervalMs: number;
}): Promise<boolean> {
  const deadline = now() + timeoutMs;
  const expected = normalizeComposerText(expectedText);
  let matchedOnce = false;

  while (now() < deadline) {
    const current = normalizeComposerText(readCurrentInput());
    if (current === expected) {
      if (matchedOnce) {
        return true;
      }
      matchedOnce = true;
    } else {
      matchedOnce = false;
    }

    await wait(pollIntervalMs);
  }

  return matchedOnce;
}

function normalizeComposerText(value: string): string {
  return value.replace(/\u00a0/g, ' ').trim();
}

export function matchesRecoveredComposerState({
  currentText,
  payload,
  composerSnapshot
}: {
  currentText: string;
  payload: string;
  composerSnapshot?: string;
}): boolean {
  const current = normalizeComposerText(currentText);
  if (!current) {
    return false;
  }

  const candidates = [
    composerSnapshot,
    payload,
    stripBridgeResultHeading(payload),
    composerSnapshot ? stripBridgeResultHeading(composerSnapshot) : undefined
  ]
    .filter((value): value is string => typeof value === 'string')
    .map(normalizeComposerText)
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);

  if (candidates.some((candidate) => candidate === current)) {
    return true;
  }

  const currentPayloads = extractResultBlockPayloads(current);
  if (currentPayloads.length > 0) {
    const hasMatchingPayload = candidates.some((candidate) => {
      const candidatePayloads = extractResultBlockPayloads(candidate);
      return candidatePayloads.some((payloadBlock) => currentPayloads.includes(payloadBlock));
    });
    if (hasMatchingPayload) {
      return true;
    }
  }

  return isBridgeManagedComposerText(current) && candidates.some((candidate) => isBridgeManagedComposerText(candidate));
}

export function matchesAuthoritativeComposerState({
  currentText,
  payload,
  composerSnapshot
}: {
  currentText: string;
  payload: string;
  composerSnapshot?: string;
}): boolean {
  const current = normalizeComposerText(currentText);
  if (!current) {
    return false;
  }

  const candidates = [
    composerSnapshot,
    payload,
    stripBridgeResultHeading(payload),
    composerSnapshot ? stripBridgeResultHeading(composerSnapshot) : undefined
  ]
    .filter((value): value is string => typeof value === 'string')
    .map(normalizeComposerText)
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);

  if (candidates.some((candidate) => candidate === current)) {
    return true;
  }

  const currentPayloads = extractResultBlockPayloads(current);
  if (currentPayloads.length === 0) {
    return false;
  }

  return candidates.some((candidate) => {
    const candidatePayloads = extractResultBlockPayloads(candidate);
    return candidatePayloads.some((payloadBlock) => currentPayloads.includes(payloadBlock));
  });
}

export function resolveRecoveredComposerDraft({
  currentText,
  payload,
  composerSnapshot,
  preservedDraft
}: {
  currentText: string;
  payload: string;
  composerSnapshot?: string;
  preservedDraft?: string;
}): string | undefined {
  const preserved = resolvePreservedDraft({
    draft: preservedDraft,
    payload
  });
  const current = normalizeComposerText(currentText);
  if (!current) {
    return preserved;
  }

  if (matchesRecoveredComposerState({ currentText, payload, composerSnapshot })) {
    return preserved;
  }

  if (isBridgeManagedComposerText(currentText)) {
    return preserved;
  }

  return currentText;
}

function resolvePreservedDraft({
  draft,
  payload
}: {
  draft?: string;
  payload: string;
}): string | undefined {
  if (typeof draft !== 'string') {
    return undefined;
  }

  const normalizedDraft = normalizeComposerText(draft);
  if (!normalizedDraft) {
    return undefined;
  }

  const normalizedPayload = normalizeComposerText(payload);
  if (normalizedDraft === normalizedPayload) {
    return undefined;
  }

  return draft;
}

function stripBridgeResultHeading(value: string): string {
  const lines = value.split('\n');
  if (lines.length < 2) {
    return value.trim();
  }

  if (
    lines[0]?.startsWith('Bridge tool result for ')
    || lines[0] === 'Bridge batch tool results for one assistant reply:'
  ) {
    return lines.slice(1).join('\n').trim();
  }

  return value.trim();
}

function extractResultBlockPayloads(value: string): string[] {
  const payloads = Array.from(
    value.matchAll(/(`{3,})(tool_result|tool_result_batch)\n([\s\S]*?)\n\1/g),
    (match) => normalizeComposerText(match[3] ?? '')
  ).filter((payload) => payload.length > 0);

  return payloads.filter((payload, index) => payloads.indexOf(payload) === index);
}

function isBridgeManagedComposerText(value: string): boolean {
  const normalized = normalizeComposerText(value);
  if (!normalized) {
    return false;
  }

  return normalized.startsWith('Bridge tool result for ')
    || normalized.startsWith('Bridge batch tool results for one assistant reply:')
    || /This result was executed outside the model after your previous .*mcp.* reply\./iu.test(normalized)
    || /These results were executed outside the model after your previous .*mcp.* reply\./iu.test(normalized)
    || normalized.includes('Continue only after reading this bridge-provided tool result.')
    || normalized.includes('Continue only after reading these bridge-provided batch results.');
}
