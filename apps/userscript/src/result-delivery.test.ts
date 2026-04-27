import { describe, expect, it, vi } from 'vitest';
import { deliverResult } from '../../extension/src/result-delivery/index.js';

describe('deliverResult', () => {
  it('uses one delivery model for single-result insertion without auto-send', async () => {
    const send = vi.fn<() => Promise<boolean>>();
    const outcome = await deliverResult({
      kind: 'single',
      payload: 'tool-result',
      autoSend: false,
      insert: () => true,
      send,
      readCurrentInput: () => 'tool-result',
      wait: async () => {}
    });

    expect(outcome.phase).toBe('inserted');
    expect(outcome.nextError).toBeUndefined();
    expect(outcome.events).toEqual([
      { level: 'success', message: 'Inserted result into ChatGPT composer.' }
    ]);
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps a valid result recoverable when composer insertion falls back to the clipboard', async () => {
    const outcome = await deliverResult({
      kind: 'single',
      payload: 'tool-result',
      autoSend: true,
      insert: () => false,
      send: async () => true,
      readCurrentInput: () => 'tool-result',
      wait: async () => {}
    });

    expect(outcome.phase).toBe('ready');
    expect(outcome.nextError).toBe('Chat input not found. Result copied to clipboard fallback.');
    expect(outcome.recovery).toEqual({
      kind: 'clipboard_fallback',
      message: 'Tool result was preserved in the clipboard. Use Insert result to retry after the chat composer is available again.'
    });
    expect(outcome.events).toEqual([
      { level: 'warn', message: 'Could not find chat input. Result copied to clipboard fallback.' }
    ]);
  });

  it('keeps execution failure meaning separate from batch delivery warnings', async () => {
    const outcome = await deliverResult({
      kind: 'batch',
      payload: 'batch-result',
      autoSend: true,
      existingError: 'Batch completed with failures. First failed tool: `grep_files` (Blocked path.)',
      insert: () => true,
      send: async () => false,
      readCurrentInput: () => 'batch-result',
      wait: async () => {}
    });

    expect(outcome.phase).toBe('inserted');
    expect(outcome.nextError).toBe('Batch completed with failures. First failed tool: `grep_files` (Blocked path.)');
    expect(outcome.recovery).toEqual({
      kind: 'send_button_missing',
      message: 'Batch result is still preserved in the ChatGPT composer. Review it there and send it manually, or copy it again from the panel.'
    });
    expect(outcome.events).toEqual([
      { level: 'success', message: 'Inserted batch result into ChatGPT composer.' },
      { level: 'warn', message: 'Batch result inserted, but the send button was not found.' }
    ]);
  });

  it('only marks the result sent after the composer actually changes', async () => {
    let currentTime = 0;
    let composerText = 'tool-result';
    const outcome = await deliverResult({
      kind: 'single',
      payload: 'tool-result',
      autoSend: true,
      insert: () => true,
      send: async () => true,
      readCurrentInput: () => composerText,
      wait: async (ms) => {
        currentTime += ms;
        composerText = '';
      },
      now: () => currentTime,
      submissionTimeoutMs: 200,
      pollIntervalMs: 50
    });

    expect(outcome.phase).toBe('sent');
    expect(outcome.nextError).toBeUndefined();
    expect(outcome.recovery).toBeUndefined();
    expect(outcome.events).toEqual([
      { level: 'success', message: 'Inserted result into ChatGPT composer.' },
      { level: 'success', message: 'Sent result back to ChatGPT.' }
    ]);
  });
});
