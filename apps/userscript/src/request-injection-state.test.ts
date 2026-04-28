import { describe, expect, it } from 'vitest';
import {
  cycleRequestInjectionMode,
  createEmptyRequestPromptSnapshot,
  describeRequestHookStatus,
  normalizeRequestInjectionMode
} from '../../extension/src/injection-runtime/request-injection-state.js';

describe('request injection state owner helpers', () => {
  it('normalizes unknown stored values to synthetic system mode', () => {
    expect(normalizeRequestInjectionMode('prepend_user')).toBe('prepend_user');
    expect(normalizeRequestInjectionMode('unexpected')).toBe('synthetic_system');
    expect(normalizeRequestInjectionMode(undefined)).toBe('synthetic_system');
  });

  it('cycles between the supported injection modes', () => {
    expect(cycleRequestInjectionMode('synthetic_system')).toBe('prepend_user');
    expect(cycleRequestInjectionMode('prepend_user')).toBe('synthetic_system');
  });

  it('creates an empty prompt snapshot without a fake source', () => {
    expect(createEmptyRequestPromptSnapshot('synthetic_system')).toEqual({
      prompt: '',
      mode: 'synthetic_system'
    });
  });

  it('describes hook status diagnostics with stable messages', () => {
    expect(describeRequestHookStatus({
      status: 'injected',
      transport: 'fetch',
      source: 'live',
      catalogVersion: 'phase1.shared-contract-freeze.v1'
    })).toEqual({
      level: 'success',
      message: 'Request hook injected live /tools catalog [phase1.shared-contract-freeze.v1] via fetch conversation request.'
    });
    expect(describeRequestHookStatus({ status: 'missing_prompt', transport: 'xhr' })).toEqual({
      level: 'warn',
      message: 'Conversation request reached the page hook before any MCP catalog prompt was ready (xhr).'
    });
    expect(describeRequestHookStatus({
      status: 'matched_without_injection',
      source: 'cache',
      catalogVersion: 'legacy-userscript-cache'
    })).toEqual({
      level: 'warn',
      message: 'Conversation request matched ChatGPT while using cached bootstrap catalog [legacy-userscript-cache], but the body shape was not patched (request).'
    });
  });
});
