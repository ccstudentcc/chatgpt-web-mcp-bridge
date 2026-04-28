import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatBatchToolResult,
  formatToolResult,
  insertIntoChatInput,
  isChatInputSubmitting,
  readCurrentChatInputText,
  sendCurrentChatInput
} from './inserter.js';

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
        path: 'apps/extension/src/main/state.ts',
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
    Reflect.deleteProperty(globalThis, 'Node');
  });

  it('reads the visible editable composer text', () => {
    class FakeHTMLElement {
      innerText = 'Tool result for `mcp_list`\u00a0';
      textContent = 'Tool result for `mcp_list`\u00a0';
      childNodes: unknown[] = [];

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

describe('insertIntoChatInput', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'document');
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'HTMLElement');
    Reflect.deleteProperty(globalThis, 'InputEvent');
    Reflect.deleteProperty(globalThis, 'Node');
  });

  it('falls back to block-structured replacement when execCommand round-trips extra blank lines', () => {
    class FakeHTMLElement {
      tagName = 'DIV';
      innerText = 'Bridge tool result for `read_file`:\n\nThis result was executed outside the model...';
      textContent = 'Bridge tool result for `read_file`:\n\nThis result was executed outside the model...';
      childNodes: unknown[] = [];
      replaceChildren = vi.fn(() => {
        this.childNodes = [];
        this.innerText = '';
        this.textContent = '';
      });
      appendChild = vi.fn((child: unknown) => {
        this.childNodes.push(child);
        return child;
      });
      focus = vi.fn();
      dispatchEvent = vi.fn();

      getAttribute(): null {
        return null;
      }
    }

    const editable = new FakeHTMLElement();
    class FakeParagraphElement extends FakeHTMLElement {
      constructor(public override tagName: string) {
        super();
        this.tagName = tagName;
      }
    }
    const selection = {
      removeAllRanges: vi.fn(),
      addRange: vi.fn()
    };

    Object.defineProperty(globalThis, 'document', {
      value: {
        querySelectorAll: (selector: string) => selector.includes('contenteditable') ? [editable] : [],
        execCommand: (command: string) => command === 'insertText',
        createRange: () => ({
          selectNodeContents: vi.fn(),
          collapse: vi.fn()
        }),
        createElement: (tagName: string) => new FakeParagraphElement(tagName.toUpperCase())
      },
      configurable: true
    });
    Object.defineProperty(globalThis, 'window', {
      value: {
        getSelection: () => selection,
        getComputedStyle: () => ({ display: 'block', visibility: 'visible' })
      },
      configurable: true
    });
    Object.defineProperty(globalThis, 'HTMLElement', { value: FakeHTMLElement, configurable: true });
    Object.defineProperty(globalThis, 'Node', { value: { TEXT_NODE: 3 }, configurable: true });
    Object.defineProperty(globalThis, 'InputEvent', {
      value: class FakeInputEvent extends Event {
        constructor(type: string, _init?: EventInit) {
          super(type, _init);
        }
      },
      configurable: true
    });

    const inserted = insertIntoChatInput('Bridge tool result for `read_file`:\nThis result was executed outside the model...');

    expect(inserted).toBe(true);
    expect(editable.replaceChildren).toHaveBeenCalledTimes(1);
    expect(editable.appendChild).toHaveBeenCalledTimes(2);
    expect((editable.childNodes[0] as FakeParagraphElement).textContent).toBe('Bridge tool result for `read_file`:');
    expect((editable.childNodes[1] as FakeParagraphElement).textContent).toBe('This result was executed outside the model...');
  });
});

describe('sendCurrentChatInput', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'document');
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'HTMLButtonElement');
    Reflect.deleteProperty(globalThis, 'MouseEvent');
  });

  it('waits for a real send button instead of clicking the stop-streaming button', async () => {
    class FakeButtonElement {
      id = 'composer-submit-button';
      disabled = false;
      dataset: Record<string, string>;
      private label: string;
      click = vi.fn();
      focus = vi.fn();
      dispatchEvent = vi.fn(() => true);

      constructor(testid: string, label: string) {
        this.dataset = { testid };
        this.label = label;
      }

      getAttribute(name: string): string | null {
        return name === 'aria-label' ? this.label : null;
      }
    }

    const stopButton = new FakeButtonElement('stop-button', '停止流式传输');
    const sendButton = new FakeButtonElement('send-button', '发送提示');

    let currentTime = 0;
    let currentButtons: FakeButtonElement[] = [stopButton];
    Object.defineProperty(globalThis, 'document', {
      value: {
        querySelectorAll: () => currentButtons
      },
      configurable: true
    });
    Object.defineProperty(globalThis, 'window', {
      value: {
        getComputedStyle: () => ({ display: 'block', visibility: 'visible' })
      },
      configurable: true
    });
    Object.defineProperty(globalThis, 'HTMLButtonElement', { value: FakeButtonElement, configurable: true });
    Object.defineProperty(globalThis, 'MouseEvent', {
      value: class FakeMouseEvent extends Event {
        constructor(type: string, _init?: EventInit) {
          super(type, _init);
        }
      },
      configurable: true
    });

    const sent = await sendCurrentChatInput({
      timeoutMs: 500,
      now: () => currentTime,
      waitForNextPoll: async (ms) => {
        currentTime += ms;
        currentButtons = [stopButton, sendButton];
      }
    });

    expect(sent).toBe(true);
    expect(stopButton.click).not.toHaveBeenCalled();
    expect(sendButton.click).toHaveBeenCalledTimes(1);
  });

  it('detects the visible stop-streaming button as an active submission state', () => {
    class FakeButtonElement {
      id = 'composer-submit-button';
      disabled = false;
      dataset = { testid: 'stop-button' };

      getAttribute(name: string): string | null {
        return name === 'aria-label' ? '停止流式传输' : null;
      }
    }

    const stopButton = new FakeButtonElement();

    Object.defineProperty(globalThis, 'document', {
      value: {
        querySelectorAll: () => [stopButton]
      },
      configurable: true
    });
    Object.defineProperty(globalThis, 'window', {
      value: {
        getComputedStyle: () => ({ display: 'block', visibility: 'visible' })
      },
      configurable: true
    });
    Object.defineProperty(globalThis, 'HTMLButtonElement', { value: FakeButtonElement, configurable: true });

    expect(isChatInputSubmitting()).toBe(true);
  });
});
