export type DeliveryKind = 'single' | 'batch';
export type DeliveryPhase = 'ready' | 'inserted' | 'sent';

export interface DeliveryLogEvent {
  level: 'success' | 'warn';
  message: string;
}

export interface DeliverResultOptions {
  kind: DeliveryKind;
  payload: string;
  autoSend: boolean;
  existingError?: string;
  insert: (value: string) => boolean;
  send: () => Promise<boolean>;
  readCurrentInput: () => string;
  wait: (ms: number) => Promise<void>;
  now?: () => number;
  submissionTimeoutMs?: number;
  pollIntervalMs?: number;
}

export interface DeliverResultOutcome {
  phase: DeliveryPhase;
  nextError?: string;
  events: DeliveryLogEvent[];
}

export async function deliverResult(options: DeliverResultOptions): Promise<DeliverResultOutcome> {
  const {
    kind,
    payload,
    autoSend,
    existingError,
    insert,
    send,
    readCurrentInput,
    wait,
    now = Date.now,
    submissionTimeoutMs = 3_000,
    pollIntervalMs = 100
  } = options;
  const messages = getDeliveryMessages(kind);

  if (!insert(payload)) {
    return {
      phase: 'ready',
      nextError: existingError ?? messages.clipboardFallbackError,
      events: [{ level: 'warn', message: messages.clipboardFallbackLog }]
    };
  }

  const events: DeliveryLogEvent[] = [{ level: 'success', message: messages.insertedLog }];
  if (!autoSend) {
    return {
      phase: 'inserted',
      nextError: existingError,
      events
    };
  }

  const sent = await send();
  const confirmed = sent
    ? await waitForSubmittedComposer({
      expectedText: payload,
      readCurrentInput,
      wait,
      now,
      submissionTimeoutMs,
      pollIntervalMs
    })
    : false;

  if (sent && confirmed) {
    events.push({ level: 'success', message: messages.sentLog });
    return {
      phase: 'sent',
      nextError: existingError,
      events
    };
  }

  const deliveryError = sent ? messages.notSubmittedError : messages.sendButtonMissingError;
  events.push({ level: 'warn', message: deliveryError });
  return {
    phase: 'inserted',
    nextError: existingError ?? deliveryError,
    events
  };
}

function getDeliveryMessages(kind: DeliveryKind): {
  insertedLog: string;
  sentLog: string;
  clipboardFallbackError: string;
  clipboardFallbackLog: string;
  sendButtonMissingError: string;
  notSubmittedError: string;
} {
  if (kind === 'batch') {
    return {
      insertedLog: 'Inserted batch result into ChatGPT composer.',
      sentLog: 'Sent batch result back to ChatGPT.',
      clipboardFallbackError: 'Chat input not found. Result copied to clipboard fallback.',
      clipboardFallbackLog: 'Could not find chat input. Result copied to clipboard fallback.',
      sendButtonMissingError: 'Batch result inserted, but the send button was not found.',
      notSubmittedError: 'Batch result was inserted and the send button was clicked, but ChatGPT did not submit the composer.'
    };
  }

  return {
    insertedLog: 'Inserted result into ChatGPT composer.',
    sentLog: 'Sent result back to ChatGPT.',
    clipboardFallbackError: 'Chat input not found. Result copied to clipboard fallback.',
    clipboardFallbackLog: 'Could not find chat input. Result copied to clipboard fallback.',
    sendButtonMissingError: 'Tool result inserted, but the send button was not found.',
    notSubmittedError: 'Tool result was inserted and the send button was clicked, but ChatGPT did not submit the composer.'
  };
}

async function waitForSubmittedComposer({
  expectedText,
  readCurrentInput,
  wait,
  now,
  submissionTimeoutMs,
  pollIntervalMs
}: {
  expectedText: string;
  readCurrentInput: () => string;
  wait: (ms: number) => Promise<void>;
  now: () => number;
  submissionTimeoutMs: number;
  pollIntervalMs: number;
}): Promise<boolean> {
  const deadline = now() + submissionTimeoutMs;
  const expected = normalizeComposerText(expectedText);

  while (now() < deadline) {
    const current = normalizeComposerText(readCurrentInput());
    if (!current || current !== expected) {
      return true;
    }

    await wait(pollIntervalMs);
  }

  return false;
}

function normalizeComposerText(value: string): string {
  return value.replace(/\u00a0/g, ' ').trim();
}
