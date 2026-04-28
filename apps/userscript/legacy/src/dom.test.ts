import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractVisibleText, findAssistantMessages, findLatestOpenAssistantMessage, onChatMutation } from './dom.js';

describe('findAssistantMessages fallback', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'document');
    Reflect.deleteProperty(globalThis, 'HTMLElement');
  });

  it('does not treat user tool_result blocks as assistant MCP replies', () => {
    class FakeHTMLElement {
      innerText: string;
      textContent: string;
      private readonly assistantTurn: FakeHTMLElement | null;

      constructor(text: string, assistantTurn: FakeHTMLElement | null = null) {
        this.innerText = text;
        this.textContent = text;
        this.assistantTurn = assistantTurn;
      }

      closest(selector: string): FakeHTMLElement | null {
        if (selector === 'pre') {
          return this;
        }
        if (selector === '[data-turn="assistant"], [data-message-author-role="assistant"]') {
          return this.assistantTurn;
        }
        return null;
      }
    }

    const assistantPre = new FakeHTMLElement('mcp\n{\n  "tool": "read_file",\n  "args": {\n    "path": "README.md"\n  }\n}');
    const userToolResultPre = new FakeHTMLElement('tool_result\n{\n  "tool": "read_file",\n  "ok": true,\n  "result": {\n    "path": "README.md"\n  }\n}');

    const documentStub = {
      querySelectorAll: (selector: string) => {
        if (selector === '[data-message-author-role="assistant"]') {
          return [];
        }
        if (selector.includes('pre')) {
          return [assistantPre, userToolResultPre];
        }
        return [];
      }
    };

    Object.defineProperty(globalThis, 'document', { value: documentStub, configurable: true });
    Object.defineProperty(globalThis, 'HTMLElement', { value: FakeHTMLElement, configurable: true });

    const result = findAssistantMessages();
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(assistantPre);
  });

  it('detects a bare pre MCP block when ChatGPT omits the inner code node', () => {
    class FakeHTMLElement {
      innerText: string;
      textContent: string;

      constructor(text: string) {
        this.innerText = text;
        this.textContent = text;
      }

      closest(selector: string): FakeHTMLElement | null {
        if (selector === 'pre') {
          return this;
        }
        return null;
      }
    }

    const assistantPre = new FakeHTMLElement('mcp\n{\n  "tool": "write_file",\n  "args": {\n    "path": "docs/prd_vnext.md"\n  }\n}');

    const documentStub = {
      querySelectorAll: (selector: string) => {
        if (selector === '[data-message-author-role="assistant"]') {
          return [];
        }
        if (selector.includes('pre')) {
          return [assistantPre];
        }
        return [];
      }
    };

    Object.defineProperty(globalThis, 'document', { value: documentStub, configurable: true });
    Object.defineProperty(globalThis, 'HTMLElement', { value: FakeHTMLElement, configurable: true });

    const result = findAssistantMessages();
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(assistantPre);
  });

  it('normalizes assistant candidates to the outer assistant turn container when the selector hits an inner node', () => {
    class FakeHTMLElement {
      innerText: string;
      textContent: string;
      private readonly assistantTurn: FakeHTMLElement | null;

      constructor(text: string, assistantTurn: FakeHTMLElement | null = null) {
        this.innerText = text;
        this.textContent = text;
        this.assistantTurn = assistantTurn;
      }

      closest(selector: string): FakeHTMLElement | null {
        if (selector === '[data-turn="assistant"]') {
          return this.assistantTurn;
        }
        if (selector === '[data-turn="assistant"], [data-message-author-role="assistant"]') {
          return this.assistantTurn ?? this;
        }
        if (selector === 'pre') {
          return this;
        }
        return null;
      }
    }

    const outerAssistantTurn = new FakeHTMLElement(
      '我准备读取项目根目录下的 README.md 文件内容。\n\nmcp\n{\n  "tool": "read_file",\n  "args": {\n    "path": "README.md"\n  }\n}\n\n已完成。'
    );
    const innerAssistantNode = new FakeHTMLElement(
      'mcp\n{\n  "tool": "read_file",\n  "args": {\n    "path": "README.md"\n  }\n}',
      outerAssistantTurn
    );

    const documentStub = {
      querySelectorAll: (selector: string) => {
        if (selector === '[data-message-author-role="assistant"]') {
          return [innerAssistantNode];
        }
        return [];
      }
    };

    Object.defineProperty(globalThis, 'document', { value: documentStub, configurable: true });
    Object.defineProperty(globalThis, 'HTMLElement', { value: FakeHTMLElement, configurable: true });

    const result = findAssistantMessages();
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(outerAssistantTurn);
  });

  it('treats a bridge tool_result after the latest assistant MCP turn as closed', () => {
    class FakeHTMLElement {
      innerText: string;
      textContent: string;
      readonly order: number;

      constructor(text: string, order: number) {
        this.innerText = text;
        this.textContent = text;
        this.order = order;
      }

      closest(): FakeHTMLElement | null {
        return this;
      }

      compareDocumentPosition(other: FakeHTMLElement): number {
        return this.order < other.order ? 4 : 2;
      }
    }

    const assistantMcp = new FakeHTMLElement('mcp\n{\n  "tool": "read_file"\n}', 1);
    const bridgeResult = new FakeHTMLElement(
      'Bridge tool result for `read_file`:\nContinue only after reading this bridge-provided tool result.',
      2
    );

    const documentStub = {
      querySelectorAll: (selector: string) => {
        if (selector === '[data-message-author-role="assistant"]') {
          return [assistantMcp];
        }
        if (selector === '[data-message-author-role="user"]') {
          return [bridgeResult];
        }
        return [];
      }
    };

    Object.defineProperty(globalThis, 'document', { value: documentStub, configurable: true });
    Object.defineProperty(globalThis, 'HTMLElement', { value: FakeHTMLElement, configurable: true });

    expect(findLatestOpenAssistantMessage()).toBeNull();
  });

  it('returns the latest assistant turn instead of revisiting older MCP history', () => {
    class FakeHTMLElement {
      innerText: string;
      textContent: string;
      readonly order: number;

      constructor(text: string, order: number) {
        this.innerText = text;
        this.textContent = text;
        this.order = order;
      }

      closest(): FakeHTMLElement | null {
        return this;
      }

      compareDocumentPosition(other: FakeHTMLElement): number {
        return this.order < other.order ? 4 : 2;
      }
    }

    const oldAssistantMcp = new FakeHTMLElement('mcp\n{\n  "tool": "read_file"\n}', 1);
    const bridgeResult = new FakeHTMLElement(
      'Bridge tool result for `read_file`:\nContinue only after reading this bridge-provided tool result.',
      2
    );
    const latestAssistantSummary = new FakeHTMLElement('这个结果说明当前 userscript 会重复扫描历史 MCP 回合。', 3);

    const documentStub = {
      querySelectorAll: (selector: string) => {
        if (selector === '[data-message-author-role="assistant"]') {
          return [oldAssistantMcp, latestAssistantSummary];
        }
        if (selector === '[data-message-author-role="user"]') {
          return [bridgeResult];
        }
        return [];
      }
    };

    Object.defineProperty(globalThis, 'document', { value: documentStub, configurable: true });
    Object.defineProperty(globalThis, 'HTMLElement', { value: FakeHTMLElement, configurable: true });

    expect(findLatestOpenAssistantMessage()).toBe(latestAssistantSummary);
  });

  it('skips a trailing empty assistant placeholder and falls back to the latest real MCP turn', () => {
    class FakeHTMLElement {
      innerText: string;
      textContent: string;
      readonly order: number;

      constructor(text: string, order: number) {
        this.innerText = text;
        this.textContent = text;
        this.order = order;
      }

      closest(): FakeHTMLElement | null {
        return this;
      }

      compareDocumentPosition(other: FakeHTMLElement): number {
        return this.order < other.order ? 4 : 2;
      }
    }

    const latestMcp = new FakeHTMLElement('mcp\n{\n  "tool": "read_file",\n  "args": {\n    "path": "docs/prd_vnext.md"\n  }\n}', 1);
    const trailingEmptyAssistant = new FakeHTMLElement('', 2);

    const documentStub = {
      querySelectorAll: (selector: string) => {
        if (selector === '[data-message-author-role="assistant"]') {
          return [latestMcp, trailingEmptyAssistant];
        }
        if (selector === '[data-message-author-role="user"]') {
          return [];
        }
        return [];
      }
    };

    Object.defineProperty(globalThis, 'document', { value: documentStub, configurable: true });
    Object.defineProperty(globalThis, 'HTMLElement', { value: FakeHTMLElement, configurable: true });

    expect(findLatestOpenAssistantMessage()).toBe(latestMcp);
  });

  it('skips a trailing thinking-only assistant placeholder and falls back to the latest real MCP turn', () => {
    class FakeHTMLElement {
      innerText: string;
      textContent: string;
      readonly order: number;

      constructor(text: string, order: number) {
        this.innerText = text;
        this.textContent = text;
        this.order = order;
      }

      closest(): FakeHTMLElement | null {
        return this;
      }

      compareDocumentPosition(other: FakeHTMLElement): number {
        return this.order < other.order ? 4 : 2;
      }
    }

    const latestMcp = new FakeHTMLElement('mcp\n{\n  "tool": "read_file",\n  "args": {\n    "path": "docs/prd_vnext.md"\n  }\n}', 1);
    const trailingThinkingAssistant = new FakeHTMLElement('Thought for a couple of seconds', 2);

    const documentStub = {
      querySelectorAll: (selector: string) => {
        if (selector === '[data-message-author-role="assistant"]') {
          return [latestMcp, trailingThinkingAssistant];
        }
        if (selector === '[data-message-author-role="user"]') {
          return [];
        }
        return [];
      }
    };

    Object.defineProperty(globalThis, 'document', { value: documentStub, configurable: true });
    Object.defineProperty(globalThis, 'HTMLElement', { value: FakeHTMLElement, configurable: true });

    expect(findLatestOpenAssistantMessage()).toBe(latestMcp);
  });

  it('skips a trailing ChatGPT shell placeholder and falls back to the latest real MCP turn', () => {
    class FakeHTMLElement {
      innerText: string;
      textContent: string;
      readonly order: number;

      constructor(text: string, order: number) {
        this.innerText = text;
        this.textContent = text;
        this.order = order;
      }

      closest(): FakeHTMLElement | null {
        return this;
      }

      compareDocumentPosition(other: FakeHTMLElement): number {
        return this.order < other.order ? 4 : 2;
      }
    }

    const latestMcp = new FakeHTMLElement('mcp\n{\n  "tool": "read_file",\n  "args": {\n    "path": "docs/prd_vnext.md"\n  }\n}', 1);
    const trailingShellAssistant = new FakeHTMLElement('ChatGPT 说：', 2);

    const documentStub = {
      querySelectorAll: (selector: string) => {
        if (selector === '[data-message-author-role="assistant"]') {
          return [latestMcp, trailingShellAssistant];
        }
        if (selector === '[data-message-author-role="user"]') {
          return [];
        }
        return [];
      }
    };

    Object.defineProperty(globalThis, 'document', { value: documentStub, configurable: true });
    Object.defineProperty(globalThis, 'HTMLElement', { value: FakeHTMLElement, configurable: true });

    expect(findLatestOpenAssistantMessage()).toBe(latestMcp);
  });

  it('reads assistant visible text from the markdown body instead of the regenerated-reply action bar', () => {
    class FakeHTMLElement {
      innerText: string;
      textContent: string;
      private readonly nestedMessage: FakeHTMLElement | null;
      private readonly nestedContent: FakeHTMLElement | null;
      private readonly isAssistantMessage: boolean;

      constructor(
        text: string,
        options: {
          nestedMessage?: FakeHTMLElement | null;
          nestedContent?: FakeHTMLElement | null;
          isAssistantMessage?: boolean;
        } = {}
      ) {
        this.innerText = text;
        this.textContent = text;
        this.nestedMessage = options.nestedMessage ?? null;
        this.nestedContent = options.nestedContent ?? null;
        this.isAssistantMessage = options.isAssistantMessage ?? false;
      }

      matches(selector: string): boolean {
        return selector === '[data-message-author-role="assistant"]' && this.isAssistantMessage;
      }

      querySelector(selector: string): FakeHTMLElement | null {
        if (selector === '[data-message-author-role="assistant"]') {
          return this.nestedMessage;
        }
        if (selector === '.markdown, [class*="markdown"]') {
          return this.nestedContent;
        }
        return null;
      }

      closest(): FakeHTMLElement | null {
        return this;
      }
    }

    const markdownBody = new FakeHTMLElement([
      'mcp',
      '{',
      '  "tool": "read_file",',
      '  "args": {',
      '    "path": "README.md"',
      '  }',
      '}'
    ].join('\n'));
    const assistantMessage = new FakeHTMLElement(`${markdownBody.innerText}\n1/2`, {
      nestedContent: markdownBody,
      isAssistantMessage: true
    });
    const assistantTurn = new FakeHTMLElement(`${markdownBody.innerText}\n1/2`, {
      nestedMessage: assistantMessage
    });

    Object.defineProperty(globalThis, 'HTMLElement', { value: FakeHTMLElement, configurable: true });

    expect(extractVisibleText(assistantTurn as unknown as HTMLElement)).toBe(markdownBody.innerText);
  });
});

describe('onChatMutation', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'document');
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'MutationObserver');
  });

  it('still triggers a scan when frequent mutations keep resetting the settle timer', () => {
    let observerCallback: (() => void) | undefined;
    const scheduled = new Map<number, () => void>();
    let nextTimerId = 1;
    const callback = vi.fn();

    class FakeMutationObserver {
      constructor(cb: () => void) {
        observerCallback = cb;
      }

      observe(): void {
        // no-op
      }
    }

    Object.defineProperty(globalThis, 'document', {
      value: {
        body: {}
      },
      configurable: true
    });
    Object.defineProperty(globalThis, 'window', {
      value: {
        setTimeout: (cb: () => void) => {
          const id = nextTimerId++;
          scheduled.set(id, cb);
          return id;
        },
        clearTimeout: (id: number) => {
          scheduled.delete(id);
        }
      },
      configurable: true
    });
    Object.defineProperty(globalThis, 'MutationObserver', {
      value: FakeMutationObserver,
      configurable: true
    });

    onChatMutation(callback);
    observerCallback?.();
    observerCallback?.();
    observerCallback?.();

    expect(callback).not.toHaveBeenCalled();
    expect(scheduled.size).toBe(2);

    const hardDeadline = [...scheduled.entries()][0];
    hardDeadline?.[1]();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(scheduled.size).toBe(0);
  });
});
