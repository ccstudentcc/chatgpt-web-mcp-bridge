import { describe, expect, it } from 'vitest';
import {
  cycleRequestInjectionMode,
  describeRequestHookStatus,
  normalizeRequestInjectionMode
} from './request-injection-state.js';

describe('request injection state compat helpers', () => {
  it('normalizes unknown stored values to synthetic system mode', () => {
    expect(normalizeRequestInjectionMode('prepend_user')).toBe('prepend_user');
    expect(normalizeRequestInjectionMode('unexpected')).toBe('synthetic_system');
    expect(normalizeRequestInjectionMode(undefined)).toBe('synthetic_system');
  });

  it('cycles between the supported injection modes', () => {
    expect(cycleRequestInjectionMode('synthetic_system')).toBe('prepend_user');
    expect(cycleRequestInjectionMode('prepend_user')).toBe('synthetic_system');
  });

  it('describes hook status diagnostics with stable messages', () => {
    expect(describeRequestHookStatus({ status: 'injected', transport: 'fetch' })).toEqual({
      level: 'success',
      message: 'Request hook injected MCP catalog via fetch conversation request.'
    });
    expect(describeRequestHookStatus({ status: 'missing_prompt', transport: 'xhr' })).toEqual({
      level: 'warn',
      message: 'Conversation request reached the page hook before the MCP catalog prompt was ready (xhr).'
    });
    expect(describeRequestHookStatus({ status: 'matched_without_injection' })).toEqual({
      level: 'warn',
      message: 'Conversation request matched ChatGPT, but the body shape was not patched (request).'
    });
  });
});
