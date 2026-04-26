import { describe, expect, it } from 'vitest';
import { canAutoRunForRequest, recordAutoRunForRequest, syncAutoRoundRequest, type AutoRoundGuardState } from './round-guard.js';

describe('round guard', () => {
  it('allows runs until the configured maxToolRounds is reached', () => {
    let state: AutoRoundGuardState = {
      requestId: 'user-1',
      count: 0,
      maxToolRounds: 3
    };

    expect(canAutoRunForRequest(state, 'user-1')).toBe(true);
    state = recordAutoRunForRequest(state, 'user-1');
    expect(canAutoRunForRequest(state, 'user-1')).toBe(true);
    state = recordAutoRunForRequest(state, 'user-1');
    expect(canAutoRunForRequest(state, 'user-1')).toBe(true);
    state = recordAutoRunForRequest(state, 'user-1');
    expect(canAutoRunForRequest(state, 'user-1')).toBe(false);
  });

  it('resets the count when a new user request appears', () => {
    const state = syncAutoRoundRequest(
      {
        requestId: 'user-1',
        count: 3,
        maxToolRounds: 3
      },
      'user-2'
    );

    expect(state).toEqual({
      requestId: 'user-2',
      count: 0,
      maxToolRounds: 3
    });
    expect(canAutoRunForRequest(state, 'user-2')).toBe(true);
  });

  it('treats non-positive maxToolRounds as unlimited for auto execution', () => {
    const state: AutoRoundGuardState = {
      requestId: 'user-1',
      count: 99,
      maxToolRounds: 0
    };

    expect(canAutoRunForRequest(state, 'user-1')).toBe(true);
  });
});
