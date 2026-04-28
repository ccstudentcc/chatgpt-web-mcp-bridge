import { describe, expect, it } from 'vitest';
import { injectCatalogIntoRequestBody } from '../../extension/src/injection-runtime/request-body-injection.js';
import { isChatGptConversationRequest } from './request-hook.js';

const prompt = [
  'Local MCP bridge tools are available in this chat.',
  'Use fenced `mcp` JSON blocks when local context is needed.'
].join('\n');

describe('isChatGptConversationRequest', () => {
  it('matches known ChatGPT conversation endpoints', () => {
    expect(isChatGptConversationRequest('https://chatgpt.com/backend-api/conversation', 'POST')).toBe(true);
    expect(isChatGptConversationRequest('/backend-anon/conversation', 'POST')).toBe(true);
    expect(isChatGptConversationRequest('/backend-api/f/conversation', 'POST')).toBe(true);
  });

  it('ignores non-post or unrelated requests', () => {
    expect(isChatGptConversationRequest('https://chatgpt.com/backend-api/conversation', 'GET')).toBe(false);
    expect(isChatGptConversationRequest('https://chatgpt.com/backend-api/models', 'POST')).toBe(false);
    expect(isChatGptConversationRequest('https://chatgpt.com/backend-api/f/conversation/prepare', 'POST')).toBe(false);
  });
});

describe('injectCatalogIntoRequestBody', () => {
  it('injects into a ChatGPT-style message part string', () => {
    const original = JSON.stringify({
      messages: [
        {
          author: { role: 'user' },
          content: {
            content_type: 'text',
            parts: ['Read README.md']
          }
        }
      ]
    });

    const result = injectCatalogIntoRequestBody(original, prompt);
    expect(result.injected).toBe(true);

    const parsed = JSON.parse(result.bodyText);
    expect(parsed.messages[0].content.parts[0]).toContain(prompt);
    expect(parsed.messages[0].content.parts[0]).toContain('Read README.md');
  });

  it('can inject a synthetic system message instead of mutating the user text', () => {
    const original = JSON.stringify({
      messages: [
        {
          author: { role: 'user' },
          content: {
            content_type: 'text',
            parts: ['Read README.md']
          }
        }
      ]
    });

    const result = injectCatalogIntoRequestBody(original, prompt, 'synthetic_system');
    expect(result.injected).toBe(true);

    const parsed = JSON.parse(result.bodyText);
    expect(parsed.messages[0].author.role).toBe('system');
    expect(parsed.messages[0].content.parts[0]).toContain(prompt);
    expect(parsed.messages[1].content.parts[0]).toBe('Read README.md');
  });

  it('injects into typed text content arrays', () => {
    const original = JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Search the src directory' }
          ]
        }
      ]
    });

    const result = injectCatalogIntoRequestBody(original, prompt);
    expect(result.injected).toBe(true);

    const parsed = JSON.parse(result.bodyText);
    expect(parsed.messages[0].content[0].text).toContain(prompt);
  });

  it('falls back to root prompt fields when messages are unavailable', () => {
    const original = JSON.stringify({ prompt: 'Summarize this repository.' });
    const result = injectCatalogIntoRequestBody(original, prompt);

    expect(result.injected).toBe(true);
    expect(JSON.parse(result.bodyText).prompt).toContain(prompt);
  });

  it('does not duplicate the prompt marker', () => {
    const alreadyInjected = JSON.stringify({
      messages: [
        {
          author: { role: 'user' },
          content: {
            parts: [`${prompt}\n\n---\n\nRead README.md`]
          }
        }
      ]
    });

    const result = injectCatalogIntoRequestBody(alreadyInjected, prompt);
    expect(result.injected).toBe(false);
    expect(result.bodyText).toBe(alreadyInjected);
  });

  it('does not duplicate an existing synthetic system prompt', () => {
    const alreadyInjected = JSON.stringify({
      messages: [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: 'Read README.md'
        }
      ]
    });

    const result = injectCatalogIntoRequestBody(alreadyInjected, prompt, 'synthetic_system');
    expect(result.injected).toBe(false);
    expect(result.bodyText).toBe(alreadyInjected);
  });

  it('leaves invalid json unchanged', () => {
    const result = injectCatalogIntoRequestBody('not-json', prompt);
    expect(result.injected).toBe(false);
    expect(result.bodyText).toBe('not-json');
  });
});
