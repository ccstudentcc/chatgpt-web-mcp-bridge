import { afterEach, describe, expect, it } from 'vitest';
import { formatBatchToolResult, formatToolResult, readCurrentChatInputText } from './inserter.js';

describe('formatToolResult', () => {
  it('makes the bridge-delivered execution boundary explicit', () => {
    const output = formatToolResult('read_file', {
      type: 'inline_tool_result',
      callId: 'call-read',
      tool: 'read_file',
      ok: true,
      output: {
        path: 'README.md',
        content: '# Hello'
      },
      summary: 'Tool read_file completed successfully.'
    });

    expect(output).toContain('Bridge tool result for `read_file`:');
    expect(output).toContain('This result was executed outside the model after your previous `mcp` reply.');
    expect(output).toContain('```tool_result');
    expect(output).toContain('"type": "inline_tool_result"');
    expect(output).toContain('Continue only after reading this bridge-provided tool result.');
  });

  it('uses a longer outer fence when file content contains triple backticks', () => {
    const output = formatToolResult('read_file', {
      type: 'inline_tool_result',
      callId: 'call-read',
      tool: 'read_file',
      ok: true,
      output: {
        path: 'apps/userscript/src/catalog.ts',
        content: '```mcp\n{\n  "tool": "read_file"\n}\n```'
      },
      summary: 'Tool read_file completed successfully.'
    });

    expect(output).toContain('````tool_result');
    expect(output).toContain('````\n\nContinue only after reading this bridge-provided tool result.');
  });

  it('renders execution-error envelopes without assuming a legacy top-level result shape', () => {
    const output = formatToolResult('write_file', {
      type: 'execution_error',
      error: {
        code: 'TOOL_DISABLED',
        summary: 'Tool disabled: write_file',
        retryable: false
      }
    });

    expect(output).toContain('"type": "execution_error"');
    expect(output).toContain('Bridge tool result for `write_file`:');
  });
});

describe('formatBatchToolResult', () => {
  it('renders a batch summary and fenced tool_result_batch block', () => {
    const output = formatBatchToolResult({
      type: 'tool_result_batch',
      ok: false,
      batchId: 'batch-1',
      source: {
        messageId: 'assistant-1'
      },
      summary: {
        total: 3,
        completed: 1,
        failed: 1,
        skipped: 1,
        stoppedOnFailure: true
      },
      items: [],
      warnings: ['Result truncated from 1000 chars.']
    });

    expect(output).toContain('Bridge batch tool results for one assistant reply:');
    expect(output).toContain('- total: 3');
    expect(output).toContain('```tool_result_batch');
    expect(output).toContain('"batchId": "batch-1"');
    expect(output).toContain('These results were executed outside the model after your previous `mcp` reply.');
    expect(output).toContain('Continue only after reading these bridge-provided batch results.');
  });
});

describe('readCurrentChatInputText', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'document');
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'HTMLElement');
  });

  it('reads the visible editable composer text', () => {
    class FakeHTMLElement {
      innerText = 'Tool result for `mcp_list`\u00a0';
      textContent = 'Tool result for `mcp_list`\u00a0';

      getAttribute(): null {
        return null;
      }
    }

    const editable = new FakeHTMLElement();

    const documentStub = {
      querySelectorAll: (selector: string) => selector.includes('contenteditable') ? [editable] : []
    };

    const windowStub = {
      getComputedStyle: () => ({ display: 'block', visibility: 'visible' })
    };

    Object.defineProperty(globalThis, 'document', { value: documentStub, configurable: true });
    Object.defineProperty(globalThis, 'window', { value: windowStub, configurable: true });
    Object.defineProperty(globalThis, 'HTMLElement', { value: FakeHTMLElement, configurable: true });

    expect(readCurrentChatInputText()).toBe('Tool result for `mcp_list`');
  });
});
