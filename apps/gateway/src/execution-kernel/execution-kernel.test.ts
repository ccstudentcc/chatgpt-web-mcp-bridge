import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import type { ExecuteRequest } from '@cwmb/tool-contracts';
import { AppError } from '@cwmb/shared-utils';
import type { GatewayConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { createExecutionKernel } from './execution-kernel.js';

describe('execution-kernel', () => {
  it('returns one inline execute result for a legacy single call', async () => {
    const logger = createLogger();
    const kernel = createExecutionKernel({
      config: createConfig(),
      logger,
      now: () => 1_700_000_000_000,
      registry: createRegistry({
        read_file: {
          enabled: true,
          risk: 'low',
          run: vi.fn(async () => ({ text: 'hello' }))
        }
      })
    });

    const response = await kernel.executeLegacyToolCall({
      tool: 'read_file',
      args: { path: 'README.md' },
      source: {
        page: 'chatgpt',
        conversationId: 'conv-1',
        callId: 'call-1'
      }
    });

    expect(response).toMatchObject({
      ok: true,
      tool: 'read_file',
      result: { text: 'hello' },
      execute: {
        requestId: 'legacy-call-1',
        executionId: 'legacy-call-1.1700000000000',
        decisions: [{ callId: 'call-1', action: 'execute' }],
        result: {
          type: 'inline_tool_result',
          callId: 'call-1',
          tool: 'read_file'
        }
      }
    });
    expect(logger.write).toHaveBeenCalledTimes(2);
    expect(logger.write).toHaveBeenNthCalledWith(1, expect.objectContaining({
      category: 'execution',
      event: 'call_completed',
      call: expect.objectContaining({
        callId: 'call-1',
        tool: 'read_file'
      })
    }));
    expect(logger.write).toHaveBeenNthCalledWith(2, expect.objectContaining({
      category: 'lifecycle',
      event: 'execution_finished',
      summary: expect.objectContaining({
        totalCalls: 1,
        completedCalls: 1,
        failedCalls: 0,
        deniedCalls: 0,
        skippedCalls: 0
      })
    }));
  });

  it('aggregates batch execution outcomes through one kernel entrypoint', async () => {
    const kernel = createExecutionKernel({
      config: createConfig(),
      logger: createLogger(),
      now: () => 1_700_000_000_100,
      registry: createRegistry({
        read_file: {
          enabled: true,
          risk: 'low',
          run: vi.fn(async () => ({ text: 'hello' }))
        },
        grep_files: {
          enabled: true,
          risk: 'low',
          run: vi.fn(async () => ({ matches: ['todo'], warnings: ['Result truncated from 1000 chars.'] }))
        }
      })
    });

    const result = await kernel.execute(createBatchRequest());

    expect(result.executeResponse).toMatchObject({
      requestId: 'req-batch-1',
      executionId: 'req-batch-1.1700000000100',
      decisions: [
        { callId: 'call-read', action: 'execute' },
        { callId: 'call-grep', action: 'execute' }
      ],
      result: {
        type: 'tool_result_batch',
        batchId: 'req-batch-1.1700000000100',
        source: { messageId: 'assistant-1' },
        summary: {
          total: 2,
          completed: 2,
          failed: 0,
          skipped: 0,
          stoppedOnFailure: false
        },
        warnings: ['Result truncated from 1000 chars.']
      }
    });
  });

  it('stops a kernel batch on the first failure by default and marks later calls as skipped', async () => {
    const logger = createLogger();
    const kernel = createExecutionKernel({
      config: createConfig(),
      logger,
      now: () => 1_700_000_000_200,
      registry: createRegistry({
        read_file: {
          enabled: true,
          risk: 'low',
          run: vi.fn(async () => ({ text: 'hello' }))
        },
        grep_files: {
          enabled: true,
          risk: 'low',
          run: vi.fn(async () => {
            throw new AppError('BLOCKED_PATH', 'Blocked path.');
          })
        },
        list_directory: {
          enabled: true,
          risk: 'low',
          run: vi.fn(async () => ({ entries: ['docs'] }))
        }
      })
    });

    const result = await kernel.execute(createBatchRequest(3));

    expect(result.executeResponse).toMatchObject({
      result: {
        type: 'tool_result_batch',
        summary: {
          total: 3,
          completed: 1,
          failed: 1,
          skipped: 1,
          stoppedOnFailure: true
        },
        items: [
          { index: 0, tool: 'read_file', ok: true },
          { index: 1, tool: 'grep_files', ok: false, error: { code: 'BLOCKED_PATH' } },
          { index: 2, tool: 'list_directory', status: 'skipped' }
        ]
      }
    });
    expect(logger.write).toHaveBeenLastCalledWith(expect.objectContaining({
      category: 'lifecycle',
      event: 'execution_finished',
      summary: expect.objectContaining({
        totalCalls: 3,
        completedCalls: 1,
        failedCalls: 0,
        deniedCalls: 1,
        skippedCalls: 1,
        stoppedOnFailure: true
      }),
      calls: [
        expect.objectContaining({ callId: 'call-read', status: 'completed' }),
        expect.objectContaining({ callId: 'call-grep', status: 'denied', reasonCode: 'BLOCKED_PATH' }),
        expect.objectContaining({ callId: 'call-list', status: 'skipped', reasonCode: 'SKIPPED_AFTER_BATCH_FAILURE' })
      ]
    }));
  });

  it('can continue a kernel batch after a failure when the caller opts in', async () => {
    const kernel = createExecutionKernel({
      config: createConfig(),
      logger: createLogger(),
      now: () => 1_700_000_000_300,
      registry: createRegistry({
        read_file: {
          enabled: true,
          risk: 'low',
          run: vi.fn(async () => ({ text: 'hello' }))
        },
        grep_files: {
          enabled: true,
          risk: 'low',
          run: vi.fn(async () => {
            throw new AppError('BLOCKED_PATH', 'Blocked path.');
          })
        },
        list_directory: {
          enabled: true,
          risk: 'low',
          run: vi.fn(async () => ({ entries: ['docs'] }))
        }
      })
    });

    const result = await kernel.execute(createBatchRequest(3), { continueOnFailure: true });

    expect(result.executeResponse).toMatchObject({
      result: {
        type: 'tool_result_batch',
        summary: {
          total: 3,
          completed: 2,
          failed: 1,
          skipped: 0,
          stoppedOnFailure: false
        },
        items: [
          { index: 0, tool: 'read_file', ok: true },
          { index: 1, tool: 'grep_files', ok: false, error: { code: 'BLOCKED_PATH' } },
          { index: 2, tool: 'list_directory', ok: true }
        ]
      }
    });
  });
});

function createBatchRequest(count = 2): ExecuteRequest {
  const calls = [
    { callId: 'call-read', tool: 'read_file', args: { path: 'README.md' }, duplicateGuardKey: 'dup-1' },
    { callId: 'call-grep', tool: 'grep_files', args: { query: 'todo' }, duplicateGuardKey: 'dup-2' },
    { callId: 'call-list', tool: 'list_directory', args: { path: 'docs' }, duplicateGuardKey: 'dup-3' }
  ];
  return {
    requestId: 'req-batch-1',
    turnContext: {
      source: {
        page: 'chatgpt',
        conversationId: 'conv-1',
        assistantTurnId: 'assistant-1'
      },
      detectionSource: 'assistant_message_scan',
      requestInjection: {
        channel: 'hidden_request_prompt',
        promptVersion: 'bridge-v1'
      },
      executionProfile: 'legacy_auto'
    },
    operatorIntent: 'auto_flow',
    calls: calls.slice(0, count) as unknown as ExecuteRequest['calls']
  };
}

function createConfig(overrides: Partial<GatewayConfig> = {}): GatewayConfig {
  return {
    host: '127.0.0.1',
    port: 8024,
    workspaceRoot: process.cwd(),
    shell: 'pwsh',
    trustedLocalMode: true,
    allowPwsh: false,
    allowWrite: false,
    autoExecuteLowRisk: true,
    autoInsertResult: true,
    autoSendResult: true,
    maxToolRounds: 3,
    maxFileSizeBytes: 1_048_576,
    maxInsertedChars: 60_000,
    maxGatewayResultChars: 200_000,
    logRetentionDays: 14,
    blockedPaths: [],
    ...overrides
  };
}

function createLogger(): Logger {
  return {
    write: vi.fn(async () => undefined)
  };
}

function createRegistry(definitions: Record<string, {
  enabled: boolean;
  risk: 'low' | 'medium' | 'high' | 'critical';
  run: (args: unknown) => Promise<unknown>;
}>){
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
      argsSchema: z.record(z.string(), z.unknown()),
      run: definition.run
    }
  ]));
}
