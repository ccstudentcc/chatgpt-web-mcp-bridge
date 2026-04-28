import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import type { ExecuteRequest } from '@cwmb/protocol';
import type { LocalTool } from '../tools/index.js';
import { assessToolCall, assertWriteEnabled, createFailureDecision, createSuccessDecision } from './call-policy.js';

describe('tool-policy call assessment', () => {
  it('allows enabled tools with parsed args', () => {
    const assessment = assessToolCall(createCall({ tool: 'read_file', args: { path: 'README.md' } }), createRegistry({
      read_file: {
        enabled: true,
        risk: 'low',
        argsSchema: z.object({ path: z.string().min(1) })
      }
    }));

    expect(assessment).toMatchObject({
      kind: 'allow',
      risk: 'low',
      args: { path: 'README.md' }
    });
  });

  it('denies disabled tools before execution', () => {
    const assessment = assessToolCall(createCall({ tool: 'write_file' }), createRegistry({
      write_file: {
        enabled: false,
        risk: 'high',
        argsSchema: z.object({})
      }
    }));

    expect(assessment).toMatchObject({
      kind: 'deny',
      risk: 'high'
    });

    if (assessment.kind !== 'deny') {
      throw new Error('Expected deny assessment');
    }

    expect(createFailureDecision('call-1', assessment.risk, assessment.error, false)).toMatchObject({
      action: 'deny',
      reasonCode: 'TOOL_DISABLED',
      risk: 'high'
    });
  });

  it('keeps malformed args as pre-execution deny outcomes without changing legacy error shaping', () => {
    const assessment = assessToolCall(createCall({ tool: 'read_file', args: { path: '' } }), createRegistry({
      read_file: {
        enabled: true,
        risk: 'low',
        argsSchema: z.object({ path: z.string().min(1) })
      }
    }));

    expect(assessment.kind).toBe('deny');
    if (assessment.kind !== 'deny') {
      throw new Error('Expected deny assessment');
    }

    expect(createFailureDecision('call-1', assessment.risk, assessment.error, false)).toMatchObject({
      action: 'deny',
      reasonCode: 'INTERNAL_ERROR',
      risk: 'low'
    });
  });

  it('exports current success and write-gating helpers', () => {
    expect(createSuccessDecision('call-1', 'medium')).toMatchObject({
      action: 'execute',
      reasonCode: 'ALLOWED_CURRENT_TOOL',
      risk: 'medium'
    });
    expect(() => assertWriteEnabled(false)).toThrowError('write_file requires allowWrite=true in gateway config.');
  });
});

function createCall(overrides: Partial<ExecuteRequest['calls'][number]> = {}): ExecuteRequest['calls'][number] {
  return {
    callId: 'call-1',
    tool: 'read_file',
    args: {},
    duplicateGuardKey: 'dup-1',
    ...overrides
  };
}

function createRegistry(definitions: Record<string, {
  enabled: boolean;
  risk: 'low' | 'medium' | 'high' | 'critical';
  argsSchema: LocalTool['argsSchema'];
}>): Map<string, LocalTool> {
  return new Map(Object.entries(definitions).map(([name, definition]) => [
    name,
    {
      name,
      title: name,
      description: `${name} test tool`,
      risk: definition.risk,
      requiresConfirmation: false,
      enabled: definition.enabled,
      exampleArgs: {},
      argsSchema: definition.argsSchema,
      run: async () => ({ ok: true })
    }
  ]));
}
