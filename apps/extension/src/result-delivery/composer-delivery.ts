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
  recovery?: DeliveryRecoveryNotice;
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
      events: [{ level: 'warn', message: messages.clipboardFallbackLog }],
      recovery: {
        kind: 'clipboard_fallback',
        message: messages.clipboardFallbackRecovery
      }
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
