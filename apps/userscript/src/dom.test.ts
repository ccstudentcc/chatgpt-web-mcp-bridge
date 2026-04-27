import { afterEach, describe, expect, it } from 'vitest';
import { findAssistantMessages } from './dom.js';

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
        if (selector === 'pre code') {
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
});
