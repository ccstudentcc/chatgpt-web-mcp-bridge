import { describe, expect, it } from 'vitest';
import { createToolDecision } from './helpers.js';

describe('createToolDecision', () => {
  it('materializes the policy decision contract without changing field names', () => {
    expect(createToolDecision({
      callId: 'call-1',
      action: 'execute',
      reasonCode: 'ALLOWED_CURRENT_TOOL',
      risk: 'low',
      message: 'Allowed by the current gateway policy.'
    })).toEqual({
      callId: 'call-1',
      action: 'execute',
      reasonCode: 'ALLOWED_CURRENT_TOOL',
      risk: 'low',
      message: 'Allowed by the current gateway policy.'
    });
  });
});
