import { afterEach, describe, expect, it } from 'vitest';
import { findAssistantMessages, findLatestOpenAssistantMessage } from './dom.js';

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
});
