import { describe, expect, it } from 'vitest';

import { deriveWorkSurfaceSnapshot } from './work-surface-contract.js';

describe('deriveWorkSurfaceSnapshot', () => {
  it('keeps the operator workflow view serializable for shared hosts', () => {
    const snapshot = deriveWorkSurfaceSnapshot({
      autoExecuteEnabled: true,
      autoInsertResult: false,
      autoSendResult: false,
      baseUrl: 'http://127.0.0.1:8317',
      catalogTools: [
        {
          name: 'read_file',
          title: 'Read File',
          description: 'Read a file',
          enabled: true,
          exampleArgs: { path: 'README.md' },
          risk: 'low',
          requiresConfirmation: false
        }
      ],
      continueBatchOnError: false,
      conversationPath: '/c/test-work-surface',
      hasLiveCatalog: true,
      logs: [
        {
          level: 'info',
          message: 'Bridge panel mounted.',
          timestamp: '12:00:00'
        }
      ],
      panelCollapsed: false,
      panelSize: {
        width: 520,
        height: 700
      },
      pending: [],
      requestInjectionMode: 'synthetic_system',
      status: 'idle',
      token: '',
      trustedLocalMode: true,
      workSurfaceMode: 'floating_panel'
    });

    expect(snapshot.conversationPath).toBe('/c/test-work-surface');
    expect(snapshot.mode).toBe('floating_panel');
    expect(snapshot.panelSize).toEqual({ width: 520, height: 700 });
    expect(snapshot.title).toBe('ChatGPT MCP Bridge');
    expect(snapshot.toolCatalogPrompt).toContain('read_file');
    expect(snapshot.view.statusLabel).toBe('idle');
    expect(snapshot.view.logEntries).toEqual([
      {
        level: 'info',
        message: 'Bridge panel mounted.',
        timestamp: '12:00:00'
      }
    ]);
  });
});
