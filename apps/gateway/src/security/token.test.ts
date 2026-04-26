import { describe, expect, it } from 'vitest';
import { assertAuthorized } from './token.js';

describe('assertAuthorized', () => {
  it('allows requests without a token in trusted local mode', () => {
    expect(() => assertAuthorized({}, { trustedLocalMode: true })).not.toThrow();
  });

  it('rejects requests without a token when trusted local mode is off', () => {
    expect(() => assertAuthorized({}, { trustedLocalMode: false, expectedToken: 'cwmb_test' })).toThrowError(/pairing token/i);
  });

  it('accepts a matching token when trusted local mode is off', () => {
    expect(() =>
      assertAuthorized({ 'x-cwmb-token': 'cwmb_test' }, { trustedLocalMode: false, expectedToken: 'cwmb_test' })
    ).not.toThrow();
  });
});
