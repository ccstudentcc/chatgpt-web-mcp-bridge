import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('state runtime snapshot helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.stubGlobal('GM_getValue', vi.fn((_key: string, defaultValue = '') => defaultValue));
    vi.stubGlobal('GM_setValue', vi.fn());
  });

  it('applies gateway automation defaults when health is stored', async () => {
    const {
      setGatewayHealth,
      state
    } = await import('./state.js');

    setGatewayHealth({
      ok: true,
      version: '0.1.0',
      platform: 'linux',
      host: '127.0.0.1',
      port: 8024,
      workspaceRoot: '/workspace',
      shell: {
        preferred: 'pwsh',
        resolved: 'pwsh',
        available: true,
        version: '7.5.0'
      },
      trustedLocalMode: false,
      autoExecuteLowRisk: true,
      autoInsertResult: true,
      autoSendResult: false,
      maxToolRounds: 5
    });

    expect(state.gatewayRuntime).toMatchObject({
      health: {
        trustedLocalMode: false,
        maxToolRounds: 5
      }
    });
    expect(state.trustedLocalMode).toBe(false);
    expect(state.maxToolRounds).toBe(5);
    expect(state.autoSendResult).toBe(false);
  });

  it('restores an undelivered inserted result only when the same composer text survived refresh', async () => {
    const storedValues = new Map<string, string>([
      ['cwmb_undelivered_result_session', JSON.stringify({
        conversationPath: '/c/test-thread',
        status: 'inserted',
        lastResult: 'tool-result',
        composerSnapshot: 'tool-result',
        lastError: undefined,
        lastDeliveryRecovery: {
          kind: 'send_button_missing',
          message: 'Tool result is still preserved in the ChatGPT composer.'
        },
        executedCallIds: ['call-1'],
        executedBatchIds: []
      })]
    ]);
    vi.stubGlobal('GM_getValue', vi.fn((key: string, defaultValue = '') => storedValues.get(key) ?? defaultValue));
    vi.stubGlobal('GM_setValue', vi.fn((key: string, value: string) => {
      storedValues.set(key, value);
    }));

    const {
      restorePersistedUndeliveredResultSession,
      state
    } = await import('./state.js');

    const restored = restorePersistedUndeliveredResultSession({
      conversationPath: '/c/test-thread',
      currentComposerText: 'tool-result'
    });

    expect(restored).toBe(true);
    expect(state.status).toBe('inserted');
    expect(state.lastResult).toBe('tool-result');
    expect([...state.executedCallIds]).toEqual(['call-1']);
  });

  it('restores an inserted result when ChatGPT keeps the composer snapshot but normalizes the bridge heading away', async () => {
    vi.stubGlobal('GM_getValue', vi.fn((key: string, defaultValue = '') => {
      if (key === 'cwmb_undelivered_result_session') {
        return JSON.stringify({
          conversationPath: '/c/test-thread',
          status: 'inserted',
          lastResult: [
            'Bridge tool result for `read_file`:',
            'This result was executed outside the model after your previous `mcp` reply.',
            '',
            '```tool_result',
            '{}',
            '```'
          ].join('\n'),
          composerSnapshot: [
            'This result was executed outside the model after your previous `mcp` reply.',
            '',
            '```tool_result',
            '{}',
            '```'
          ].join('\n'),
          executedCallIds: ['call-1'],
          executedBatchIds: []
        });
      }
      return defaultValue;
    }));
    vi.stubGlobal('GM_setValue', vi.fn());

    const {
      restorePersistedUndeliveredResultSession,
      state
    } = await import('./state.js');

    const restored = restorePersistedUndeliveredResultSession({
      conversationPath: '/c/test-thread',
      currentComposerText: [
        'This result was executed outside the model after your previous `mcp` reply.',
        '',
        '```tool_result',
        '{}',
        '```'
      ].join('\n')
    });

    expect(restored).toBe(true);
    expect(state.status).toBe('inserted');
    expect([...state.executedCallIds]).toEqual(['call-1']);
  });

  it('restores an inserted result when refresh only keeps bridge heading and explanatory residue', async () => {
    vi.stubGlobal('GM_getValue', vi.fn((key: string, defaultValue = '') => {
      if (key === 'cwmb_undelivered_result_session') {
        return JSON.stringify({
          conversationPath: '/c/test-thread',
          status: 'inserted',
          lastResult: [
            'Bridge tool result for `read_file`:',
            'This result was executed outside the model after your previous `mcp` reply. Treat the fenced `tool_result` block below as the authoritative execution result.',
            '',
            '```tool_result',
            '{',
            '  "type": "inline_tool_result"',
            '}',
            '```'
          ].join('\n'),
          composerSnapshot: [
            'Bridge tool result for `read_file`:',
            'This result was executed outside the model after your previous `mcp` reply. Treat the fenced `tool_result` block below as the authoritative execution result.'
          ].join('\n'),
          preservedDraft: 'keep this draft',
          executedCallIds: ['call-1'],
          executedBatchIds: []
        });
      }
      return defaultValue;
    }));
    vi.stubGlobal('GM_setValue', vi.fn());

    const {
      restorePersistedUndeliveredResultSession,
      state
    } = await import('./state.js');

    const restored = restorePersistedUndeliveredResultSession({
      conversationPath: '/c/test-thread',
      currentComposerText: [
        '',
        'This result was executed outside the model after your previous `mcp` reply. Treat the fenced `tool_result` block below as the authoritative execution result.'
      ].join('\n')
    });

    expect(restored).toBe(true);
    expect(state.status).toBe('inserted');
    expect(state.preservedDraft).toBe('keep this draft');
    expect(state.recoveredComposerSnapshot).toBe([
      'Bridge tool result for `read_file`:',
      'This result was executed outside the model after your previous `mcp` reply. Treat the fenced `tool_result` block below as the authoritative execution result.'
    ].join('\n'));
  });

  it('restores an inserted result when refresh keeps the same tool_result payload but changes fence length', async () => {
    vi.stubGlobal('GM_getValue', vi.fn((key: string, defaultValue = '') => {
      if (key === 'cwmb_undelivered_result_session') {
        return JSON.stringify({
          conversationPath: '/c/test-thread',
          status: 'inserted',
          lastResult: [
            'Bridge tool result for `read_file`:',
            'This result was executed outside the model after your previous `mcp` reply. Treat the fenced `tool_result` block below as the authoritative execution result.',
            '',
            '```tool_result',
            '{',
            '  "type": "inline_tool_result"',
            '}',
            '```'
          ].join('\n'),
          executedCallIds: ['call-1'],
          executedBatchIds: []
        });
      }
      return defaultValue;
    }));
    vi.stubGlobal('GM_setValue', vi.fn());

    const {
      restorePersistedUndeliveredResultSession,
      state
    } = await import('./state.js');

    const restored = restorePersistedUndeliveredResultSession({
      conversationPath: '/c/test-thread',
      currentComposerText: [
        'This result was executed outside the model after your previous `mcp` reply. Treat the fenced `tool_result` block below as the authoritative execution result.',
        '',
        '`````tool_result',
        '{',
        '  "type": "inline_tool_result"',
        '}',
        '`````'
      ].join('\n')
    });

    expect(restored).toBe(true);
    expect(state.status).toBe('inserted');
    expect([...state.executedCallIds]).toEqual(['call-1']);
  });

  it('clears a stale undelivered result snapshot when the composer no longer matches after refresh', async () => {
    const setValue = vi.fn();
    vi.stubGlobal('GM_getValue', vi.fn((key: string, defaultValue = '') => {
      if (key === 'cwmb_undelivered_result_session') {
        return JSON.stringify({
          conversationPath: '/c/test-thread',
          status: 'inserted',
          lastResult: 'tool-result',
          executedCallIds: ['call-1'],
          executedBatchIds: []
        });
      }
      return defaultValue;
    }));
    vi.stubGlobal('GM_setValue', setValue);

    const {
      restorePersistedUndeliveredResultSession
    } = await import('./state.js');

    const restored = restorePersistedUndeliveredResultSession({
      conversationPath: '/c/test-thread',
      currentComposerText: ''
    });

    expect(restored).toBe(false);
    expect(setValue).toHaveBeenCalledWith('cwmb_undelivered_result_session', '');
  });

  it('does not clear an undelivered result snapshot during a non-destructive startup probe', async () => {
    const setValue = vi.fn();
    vi.stubGlobal('GM_getValue', vi.fn((key: string, defaultValue = '') => {
      if (key === 'cwmb_undelivered_result_session') {
        return JSON.stringify({
          conversationPath: '/c/test-thread',
          status: 'inserted',
          lastResult: 'tool-result',
          executedCallIds: ['call-1'],
          executedBatchIds: []
        });
      }
      return defaultValue;
    }));
    vi.stubGlobal('GM_setValue', setValue);

    const {
      restorePersistedUndeliveredResultSession
    } = await import('./state.js');

    const restored = restorePersistedUndeliveredResultSession({
      conversationPath: '/c/test-thread',
      currentComposerText: '',
      clearOnMismatch: false
    });

    expect(restored).toBe(false);
    expect(setValue).not.toHaveBeenCalledWith('cwmb_undelivered_result_session', '');
  });

  it('reports that a persisted undelivered result session still exists for the same conversation', async () => {
    vi.stubGlobal('GM_getValue', vi.fn((key: string, defaultValue = '') => {
      if (key === 'cwmb_undelivered_result_session') {
        return JSON.stringify({
          conversationPath: '/c/test-thread',
          status: 'inserted',
          lastResult: 'tool-result',
          executedCallIds: ['call-1'],
          executedBatchIds: []
        });
      }
      return defaultValue;
    }));
    vi.stubGlobal('GM_setValue', vi.fn());

    const {
      hasPersistedUndeliveredResultSession
    } = await import('./state.js');

    expect(hasPersistedUndeliveredResultSession('/c/test-thread')).toBe(true);
    expect(hasPersistedUndeliveredResultSession('/c/other-thread')).toBe(false);
  });

  it('only treats persisted bridge-like composer text as an active undelivered-result match', async () => {
    vi.stubGlobal('GM_getValue', vi.fn((key: string, defaultValue = '') => {
      if (key === 'cwmb_undelivered_result_session') {
        return JSON.stringify({
          conversationPath: '/c/test-thread',
          status: 'inserted',
          lastResult: [
            'Bridge tool result for `read_file`:',
            'This result was executed outside the model after your previous `mcp` reply.',
            '',
            '```tool_result',
            '{}',
            '```'
          ].join('\n'),
          executedCallIds: ['call-1'],
          executedBatchIds: []
        });
      }
      return defaultValue;
    }));
    vi.stubGlobal('GM_setValue', vi.fn());

    const {
      matchesPersistedUndeliveredResultSession
    } = await import('./state.js');

    expect(matchesPersistedUndeliveredResultSession({
      conversationPath: '/c/test-thread',
      currentComposerText: 'This result was executed outside the model after your previous `mcp` reply.'
    })).toBe(true);
    expect(matchesPersistedUndeliveredResultSession({
      conversationPath: '/c/test-thread',
      currentComposerText: 'my unrelated draft'
    })).toBe(false);
    expect(matchesPersistedUndeliveredResultSession({
      conversationPath: '/c/test-thread',
      currentComposerText: ''
    })).toBe(false);
  });
});
