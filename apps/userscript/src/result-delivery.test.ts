import { describe, expect, it, vi } from 'vitest';
import {
  deliverResult,
  matchesRecoveredComposerState,
  resolveRecoveredComposerDraft
} from '../../extension/src/result-delivery/index.js';

describe('deliverResult', () => {
  it('uses one delivery model for single-result insertion without auto-send', async () => {
    const send = vi.fn<() => Promise<boolean>>();
    const outcome = await deliverResult({
      kind: 'single',
      payload: 'tool-result',
      autoSend: false,
      preservedDraft: 'user draft',
      insert: () => true,
      restore: () => true,
      send,
      readCurrentInput: () => 'tool-result',
      wait: async () => {}
    });

    expect(outcome.phase).toBe('inserted');
    expect(outcome.nextError).toBeUndefined();
    expect(outcome.nextPreservedDraft).toBe('user draft');
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
      preservedDraft: 'user draft',
      insert: () => false,
      restore: () => true,
      send: async () => true,
      readCurrentInput: () => 'tool-result',
      wait: async () => {}
    });

    expect(outcome.phase).toBe('ready');
    expect(outcome.nextError).toBe('Chat input not found. Result copied to clipboard fallback.');
    expect(outcome.nextPreservedDraft).toBe('user draft');
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
      preservedDraft: 'kept draft',
      insert: () => true,
      restore: () => true,
      send: async () => false,
      readCurrentInput: () => 'batch-result',
      wait: async () => {}
    });

    expect(outcome.phase).toBe('inserted');
    expect(outcome.nextError).toBe('Batch completed with failures. First failed tool: `grep_files` (Blocked path.)');
    expect(outcome.nextPreservedDraft).toBe('kept draft');
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
    const restore = vi.fn(() => true);
    const outcome = await deliverResult({
      kind: 'single',
      payload: 'tool-result',
      autoSend: true,
      preservedDraft: 'user draft',
      insert: () => true,
      restore,
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
    expect(outcome.nextPreservedDraft).toBeUndefined();
    expect(outcome.recovery).toBeUndefined();
    expect(restore).toHaveBeenCalledWith('user draft');
    expect(outcome.events).toEqual([
      { level: 'success', message: 'Inserted result into ChatGPT composer.' },
      { level: 'success', message: 'Sent result back to ChatGPT.' }
    ]);
  });

  it('restores the preserved draft after ChatGPT enters submission even before the composer clears', async () => {
    let currentTime = 0;
    const restore = vi.fn(() => true);
    const outcome = await deliverResult({
      kind: 'single',
      payload: 'tool-result',
      autoSend: true,
      preservedDraft: 'user draft',
      insert: () => true,
      restore,
      send: async () => true,
      isSubmitting: () => currentTime >= 50,
      readCurrentInput: () => 'tool-result',
      wait: async (ms) => {
        currentTime += ms;
      },
      now: () => currentTime,
      submissionTimeoutMs: 200,
      pollIntervalMs: 50
    });

    expect(outcome.phase).toBe('sent');
    expect(outcome.nextPreservedDraft).toBeUndefined();
    expect(restore).toHaveBeenCalledWith('user draft');
  });

  it('does not confirm send just because the inserted composer snapshot differs from the original payload', async () => {
    let currentTime = 0;
    let composerText = 'Bridge tool result for `read_file`:\n\nThis result was executed outside the model...';
    const outcome = await deliverResult({
      kind: 'single',
      payload: 'Bridge tool result for `read_file`:\nThis result was executed outside the model...',
      autoSend: true,
      insert: () => true,
      restore: () => true,
      send: async () => true,
      isSubmitting: () => currentTime >= 100,
      readCurrentInput: () => composerText,
      wait: async (ms) => {
        currentTime += ms;
        if (currentTime >= 100) {
          composerText = '';
        }
      },
      now: () => currentTime,
      submissionTimeoutMs: 300,
      pollIntervalMs: 50
    });

    expect(outcome.phase).toBe('sent');
  });

  it('does not treat an already-submitting page state as successful send confirmation by itself', async () => {
    let currentTime = 0;
    const outcome = await deliverResult({
      kind: 'single',
      payload: 'tool-result',
      autoSend: true,
      insert: () => true,
      restore: () => true,
      send: async () => true,
      isSubmitting: () => true,
      readCurrentInput: () => 'tool-result',
      wait: async (ms) => {
        currentTime += ms;
      },
      now: () => currentTime,
      submissionTimeoutMs: 150,
      pollIntervalMs: 50
    });

    expect(outcome.phase).toBe('inserted');
    expect(outcome.recovery?.kind).toBe('submission_not_confirmed');
  });

  it('treats bridge-owned refresh residue as recovered delivery state instead of a user draft', () => {
    const payload = [
      'Bridge tool result for `read_file`:',
      'This result was executed outside the model after your previous `mcp` reply. Treat the fenced `tool_result` block below as the authoritative execution result.',
      '',
      '```tool_result',
      '{',
      '  "type": "inline_tool_result"',
      '}',
      '```'
    ].join('\n');

    expect(matchesRecoveredComposerState({
      currentText: [
        'Bridge tool result for `read_file`:',
        'This result was executed outside the model after your previous `mcp` reply. Treat the fenced `tool_result` block below as the authoritative execution result.'
      ].join('\n'),
      payload
    })).toBe(true);

    expect(resolveRecoveredComposerDraft({
      currentText: [
        'Bridge tool result for `read_file`:',
        'This result was executed outside the model after your previous `mcp` reply. Treat the fenced `tool_result` block below as the authoritative execution result.'
      ].join('\n'),
      payload,
      preservedDraft: 'kept user draft'
    })).toBe('kept user draft');
  });

  it('preserves unrelated user drafts when recovering a sendable bridge result', () => {
    const payload = 'Bridge tool result for `read_file`:\n```tool_result\n{}\n```';

    expect(resolveRecoveredComposerDraft({
      currentText: 'keep this manual note',
      payload,
      preservedDraft: undefined
    })).toBe('keep this manual note');
  });
});
