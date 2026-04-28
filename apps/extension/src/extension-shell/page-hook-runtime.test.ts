import { describe, expect, it } from 'vitest';
import { isChatGptConversationRequest } from './page-hook-runtime.js';

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
