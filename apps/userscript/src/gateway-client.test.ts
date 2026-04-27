import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('gateway-client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.stubGlobal('GM_getValue', vi.fn((key: string, defaultValue = '') => defaultValue));
    vi.stubGlobal('GM_setValue', vi.fn());
  });

  it('returns success payloads with execute compat metadata intact', async () => {
    vi.stubGlobal('GM_xmlhttpRequest', vi.fn((options: {
      onload?: (response: { status: number; responseText: string }) => void;
    }) => {
      options.onload?.({
        status: 200,
        responseText: JSON.stringify({
          ok: true,
          tool: 'read_file',
          result: { text: 'hello' },
          warnings: [],
          durationMs: 3,
          execute: {
            requestId: 'legacy-call-0001',
            executionId: 'legacy-call-0001.exec',
            decisions: [
              {
                callId: 'call-0001',
                action: 'execute',
                reasonCode: 'ALLOWED_CURRENT_TOOL',
                risk: 'low',
                message: 'Allowed by the current gateway policy.'
              }
            ],
            result: {
              type: 'inline_tool_result',
              callId: 'call-0001',
              tool: 'read_file',
              ok: true,
              output: { text: 'hello' },
              summary: 'Tool read_file completed successfully.'
            }
          }
        })
      });
    }));

    const { callTool } = await import('./gateway-client.js');
    const response = await callTool({
      tool: 'read_file',
      args: { path: 'README.md' },
      source: {
        page: 'chatgpt',
        callId: 'call-0001'
      }
    });

    expect(response).toMatchObject({
      ok: true,
      tool: 'read_file',
      result: { text: 'hello' },
      execute: {
        requestId: 'legacy-call-0001',
        executionId: 'legacy-call-0001.exec',
        decisions: [{ action: 'execute' }],
        result: { type: 'inline_tool_result' }
      }
    });
  });

  it('still reads the earlier flat compat shape during the transition', async () => {
    vi.stubGlobal('GM_xmlhttpRequest', vi.fn((options: {
      onload?: (response: { status: number; responseText: string }) => void;
    }) => {
      options.onload?.({
        status: 200,
        responseText: JSON.stringify({
          ok: true,
          tool: 'read_file',
          result: {
            type: 'inline_tool_result',
            callId: 'call-0001',
            tool: 'read_file',
            ok: true,
            output: { text: 'hello' },
            summary: 'Tool read_file completed successfully.'
          },
          warnings: [],
          durationMs: 3,
          requestId: 'legacy-call-0001',
          executionId: 'legacy-call-0001.exec',
          decisions: [
            {
              callId: 'call-0001',
              action: 'execute',
              reasonCode: 'ALLOWED_CURRENT_TOOL',
              risk: 'low',
              message: 'Allowed by the current gateway policy.'
            }
          ]
        })
      });
    }));

    const { callTool } = await import('./gateway-client.js');
    const response = await callTool({
      tool: 'read_file',
      args: { path: 'README.md' },
      source: {
        page: 'chatgpt',
        callId: 'call-0001'
      }
    });

    expect(response).toMatchObject({
      ok: true,
      tool: 'read_file',
      result: { type: 'inline_tool_result' }
    });
  });

  it('throws failures with execute compat metadata preserved on the error object', async () => {
    vi.stubGlobal('GM_xmlhttpRequest', vi.fn((options: {
      onload?: (response: { status: number; responseText: string }) => void;
    }) => {
      options.onload?.({
        status: 200,
        responseText: JSON.stringify({
          ok: false,
          tool: 'write_file',
          error: {
            code: 'TOOL_DISABLED',
            message: 'Tool disabled: write_file'
          },
          warnings: [],
          durationMs: 2,
          execute: {
            requestId: 'legacy-call-0002',
            executionId: 'legacy-call-0002.exec',
            decisions: [
              {
                callId: 'call-0002',
                action: 'deny',
                reasonCode: 'TOOL_DISABLED',
                risk: 'high',
                message: 'Tool disabled: write_file'
              }
            ],
            result: {
              type: 'execution_error',
              error: {
                code: 'TOOL_DISABLED',
                summary: 'Tool disabled: write_file',
                retryable: false
              }
            }
          }
        })
      });
    }));

    const { callTool } = await import('./gateway-client.js');
    await expect(callTool({
      tool: 'write_file',
      args: { path: 'docs/example.md', content: 'hello' },
      source: {
        page: 'chatgpt',
        callId: 'call-0002'
      }
    })).rejects.toMatchObject({
      message: 'Tool disabled: write_file',
      code: 'TOOL_DISABLED',
      execute: {
        requestId: 'legacy-call-0002',
        executionId: 'legacy-call-0002.exec',
        decisions: [{ action: 'deny' }],
        result: { type: 'execution_error' }
      }
    });
  });
});
