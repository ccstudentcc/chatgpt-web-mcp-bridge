import { describe, expect, it } from 'vitest';
import { hasRedactableSecretLikeContent, hasSecretLikeContent, redactSecretLikeContent } from './redact.js';

describe('redactSecretLikeContent', () => {
  it('redacts assignment-style placeholders without treating them as blocking secrets', () => {
    const input = 'const token = getToken();';
    expect(redactSecretLikeContent(input)).toContain('[REDACTED]');
    expect(hasRedactableSecretLikeContent(input)).toBe(true);
    expect(hasSecretLikeContent(input)).toBe(false);
  });

  it('treats high-confidence credentials as blocking secrets', () => {
    const input = 'token=sk-1234567890abcdef';
    expect(redactSecretLikeContent(input)).toContain('[REDACTED]');
    expect(hasRedactableSecretLikeContent(input)).toBe(true);
    expect(hasSecretLikeContent(input)).toBe(true);
  });

  it('leaves ordinary text unchanged', () => {
    const input = 'hello world';
    expect(redactSecretLikeContent(input)).toBe(input);
    expect(hasRedactableSecretLikeContent(input)).toBe(false);
    expect(hasSecretLikeContent(input)).toBe(false);
  });
});
