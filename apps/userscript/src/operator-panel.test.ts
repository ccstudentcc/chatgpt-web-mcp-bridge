import type { CatalogToolDescriptor, GatewayRuntimeSnapshot } from '@cwmb/protocol';
import { describe, expect, it } from 'vitest';
import {
  deriveOperatorPanelViewState,
  type OperatorPanelViewInput
} from '../../extension/src/operator-panel/index.js';
import type { ParsedMcpBlock } from './parser.js';

describe('deriveOperatorPanelViewState', () => {
  it('keeps cached bootstrap runtime facts readable without pretending they are live execution truth', () => {
    const view = deriveOperatorPanelViewState(createInput({
      gatewayRuntime: createGatewayRuntime({
        catalogSource: 'cache',
        catalog: {
          catalogVersion: 'phase2.operator-panel.v1',
          generatedAt: '2026-04-28T10:00:00.000Z',
          workspaceRoot: '/workspace',
          tools: createTools()
        }
      }),
      hasLiveCatalog: false,
      requestPromptSource: 'cache'
    }));

    expect(view.runtimeStats).toContainEqual({ label: 'Catalog', value: '1 / 2' });
    expect(view.runtimeStats).toContainEqual({ label: 'Catalog src', value: 'Cached bootstrap' });
    expect(view.runtimeStats).toContainEqual({ label: 'Injection', value: 'Armed (cached)' });
    expect(view.automationNotice).toEqual({
      tone: 'muted',
      message: 'Cached bootstrap catalog is arming hidden request injection until the next successful live /tools sync.'
    });
  });

  it('keeps high-risk pending work manual while exposing the same run intent surface', () => {
    const view = deriveOperatorPanelViewState(createInput({
      autoExecuteEnabled: true,
      hasLiveCatalog: true,
      pending: [createPendingBlock('write_file', { path: 'docs/example.md', content: '# hi' })],
      status: 'detected',
      catalogTools: [
        {
          name: 'write_file',
          title: 'Write file',
          description: 'Write a file.',
          risk: 'high',
          requiresConfirmation: true,
          enabled: true,
          exampleArgs: { path: 'docs/example.md', content: '# hi', mode: 'replace' }
        }
      ]
    }));

    expect(view.intentActions).toContainEqual({ action: 'run', label: 'Run', tone: 'primary' });
    expect(view.intentActions).toContainEqual({ action: 'ignore', label: 'Ignore', tone: 'danger' });
    expect(view.intentActions).toContainEqual({ action: 'copy-json', label: 'Copy JSON', tone: 'ghost' });
    expect(view.manualRunNotice?.message).toContain('must be run manually');
    expect(view.runtimeStats).toContainEqual({ label: 'Risk', value: 'High' });
    expect(view.toggles).toEqual([
      { action: 'toggle-execute', label: 'Execute', enabled: true },
      { action: 'toggle-insert', label: 'Insert', enabled: true },
      { action: 'toggle-send', label: 'Send', enabled: true },
      { action: 'toggle-continue-batch', label: 'Continue on error', enabled: false }
    ]);
  });

  it('surfaces request-hook patch failures as panel diagnostics instead of leaving them buried in the log', () => {
    const view = deriveOperatorPanelViewState(createInput({
      gatewayRuntime: createGatewayRuntime({
        catalogSource: 'live',
        catalog: {
          catalogVersion: 'phase2.operator-panel.v1',
          generatedAt: '2026-04-28T10:00:00.000Z',
          workspaceRoot: '/workspace',
          tools: createTools()
        }
      }),
      hasLiveCatalog: true,
      lastRequestHook: {
        status: 'matched_without_injection',
        transport: 'fetch',
        source: 'live',
        catalogVersion: 'phase2.operator-panel.v1'
      },
      requestPromptSource: 'live'
    }));

    expect(view.runtimeStats).toContainEqual({ label: 'Injection', value: 'Body not patched' });
    expect(view.automationNotice).toEqual({
      tone: 'warn',
      message: 'The last ChatGPT conversation request matched the page hook, but its body was not patched (fetch). Insert/Copy MCP list remains the current recovery path.'
    });
  });
});

function createInput(
  overrides: Partial<OperatorPanelViewInput<ParsedMcpBlock>> = {}
): OperatorPanelViewInput<ParsedMcpBlock> {
  return {
    autoExecuteEnabled: false,
    autoInsertResult: true,
    autoSendResult: true,
    baseUrl: 'http://127.0.0.1:8024',
    catalogTools: createTools(),
    continueBatchOnError: false,
    gatewayRuntime: createGatewayRuntime(),
    hasLiveCatalog: true,
    lastDeliveryRecovery: undefined,
    lastError: undefined,
    lastRequestHook: undefined,
    lastResult: undefined,
    logs: [],
    panelCollapsed: false,
    pending: [],
    pendingBatchId: undefined,
    progress: undefined,
    requestInjectionMode: 'synthetic_system',
    requestPromptCatalogVersion: undefined,
    requestPromptSource: 'live',
    retryableBatch: undefined,
    status: 'idle',
    token: '',
    trustedLocalMode: true,
    ...overrides
  };
}

function createGatewayRuntime(
  overrides: Partial<GatewayRuntimeSnapshot> = {}
): GatewayRuntimeSnapshot {
  return {
    health: {
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
        version: '5.2.21'
      },
      trustedLocalMode: true,
      autoExecuteLowRisk: true,
      autoInsertResult: true,
      autoSendResult: true,
      maxToolRounds: 3
    },
    catalog: {
      catalogVersion: 'phase2.operator-panel.v1',
      generatedAt: '2026-04-28T10:00:00.000Z',
      workspaceRoot: '/workspace',
      tools: createTools()
    },
    catalogSource: 'live',
    ...overrides
  };
}

function createTools(): CatalogToolDescriptor[] {
  return [
    {
      name: 'read_file',
      title: 'Read file',
      description: 'Read a text file.',
      displayName: 'Read file',
      source: 'builtin',
      risk: 'low',
      requiresConfirmation: false,
      enabled: true,
      exampleArgs: { path: 'README.md' }
    },
    {
      name: 'write_file',
      title: 'Write file',
      description: 'Write a text file.',
      displayName: 'Write file',
      source: 'builtin',
      risk: 'high',
      requiresConfirmation: true,
      enabled: false,
      exampleArgs: { path: 'docs/example.md', content: '# hi', mode: 'replace' }
    }
  ];
}

function createPendingBlock(tool: string, args: Record<string, unknown>): ParsedMcpBlock {
  return {
    block: { tool, args },
    raw: JSON.stringify({ tool, args }),
    callId: `call-${tool}`
  };
}
