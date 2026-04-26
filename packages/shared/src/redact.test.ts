import { describe, expect, it } from 'vitest';
import { hasSecretLikeContent, redactSecretLikeContent } from './redact.js';

describe('redactSecretLikeContent', () => {
  it('redacts common token assignment patterns', () => {
    const input = 'token=sk-1234567890abcdef';
    expect(redactSecretLikeContent(input)).toContain('[REDACTED]');
    expect(hasSecretLikeContent(input)).toBe(true);
  });

  it('leaves ordinary text unchanged', () => {
    const input = 'hello world';
    expect(redactSecretLikeContent(input)).toBe(input);
    expect(hasSecretLikeContent(input)).toBe(false);
  });
});
