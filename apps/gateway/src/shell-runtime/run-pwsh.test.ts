import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@cwmb/shared';
import { DEFAULT_SHELL_TIMEOUT_MS, RunPwshArgsSchema, executeRunPwsh, guardRunPwshInput, prepareRunPwshExecution } from './index.js';
import type { RunPwshArgs } from './run-pwsh.js';
import type { SpawnImpl } from './types.js';

const tempRoots: string[] = [];

describe('shell-runtime run_pwsh', () => {
  afterEach(async () => {
    vi.useRealTimers();
    while (tempRoots.length > 0) {
      const root = tempRoots.pop();
      if (root) {
        await fs.rm(root, { recursive: true, force: true });
      }
    }
  });

  it('guards empty commands before spawning a shell', () => {
    try {
      guardRunPwshInput(
        RunPwshArgsSchema.parse({
          command: '   ',
          cwd: '.',
          timeoutMs: DEFAULT_SHELL_TIMEOUT_MS
        })
      );
      throw new Error('Expected guardRunPwshInput to reject an empty command.');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        code: 'INVALID_SHELL_COMMAND'
      });
    }
  });

  it('shapes cwd and environment inside the workspace boundary', async () => {
    const workspaceRoot = await createWorkspaceRoot();
    const shellCwd = path.join(workspaceRoot, 'packages', 'gateway');
    await fs.mkdir(shellCwd, { recursive: true });

    const prepared = await prepareRunPwshExecution(
      RunPwshArgsSchema.parse({
        command: 'Get-ChildItem .',
        cwd: 'packages/gateway',
        timeoutMs: 5_000
      }),
      {
        workspaceRoot,
        blockedPaths: ['.env', '.env.*'],
        shell: 'powershell.exe'
      },
      { PATH: '/usr/bin' }
    );

    expect(prepared).toMatchObject({
      shell: 'powershell.exe',
      command: 'Get-ChildItem .',
      cwd: shellCwd,
      timeoutMs: 5_000,
      spawnArgs: ['-NoProfile', '-NonInteractive', '-Command', 'Get-ChildItem .']
    });
    expect(prepared.env).toMatchObject({
      PATH: '/usr/bin',
      CWMB_WORKSPACE_ROOT: workspaceRoot,
      PWD: shellCwd,
      NO_COLOR: '1',
      TERM: 'dumb'
    });
  });

  it('returns a captured output contract for successful execution', async () => {
    const workspaceRoot = await createWorkspaceRoot();
    const shellCwd = path.join(workspaceRoot, 'scripts');
    await fs.mkdir(shellCwd, { recursive: true });

    const spawnImpl = vi.fn((command: string, args: readonly string[], options?: NodeJS.ProcessEnv extends never ? never : {
      cwd?: string;
      env?: NodeJS.ProcessEnv;
      windowsHide?: boolean;
    }) => {
      expect(command).toBe('pwsh');
      expect(args).toEqual(['-NoProfile', '-NonInteractive', '-Command', 'Write-Output hi']);
      expect(options).toMatchObject({
        cwd: shellCwd,
        windowsHide: true
      });
      expect(options?.env).toMatchObject({
        CWMB_WORKSPACE_ROOT: workspaceRoot,
        PWD: shellCwd
      });

      const child = createMockChild();
      queueMicrotask(() => {
        child.stdout.write('hello\n');
        child.stderr.write('warning\n');
        child.stdout.end();
        child.stderr.end();
        child.emit('close', 0, null);
      });
      return child as never;
    }) as unknown as SpawnImpl;

    const result = await executeRunPwsh(
      RunPwshArgsSchema.parse({
        command: 'Write-Output hi',
        cwd: 'scripts',
        timeoutMs: 5_000
      }),
      makeShellConfig(workspaceRoot, { shell: 'pwsh', maxGatewayResultChars: 12 }),
      { spawnImpl, envSource: { PATH: '/usr/bin' }, now: vi.fn(() => 1_000).mockReturnValueOnce(1_000).mockReturnValueOnce(1_025) }
    );

    expect(result).toMatchObject({
      shell: 'pwsh',
      command: 'Write-Output hi',
      cwd: shellCwd,
      exitCode: 0,
      signal: null,
      timedOut: false,
      durationMs: 25,
      output: {
        stdout: {
          text: expect.stringContaining('hello'),
          originalSizeChars: 6
        },
        stderr: {
          text: expect.stringContaining('warning'),
          originalSizeChars: 8
        },
        combined: {
          originalSizeChars: 14
        }
      },
      warnings: []
    });
  });

  it('shapes timeout failures with captured partial output', async () => {
    const workspaceRoot = await createWorkspaceRoot();
    const shellCwd = path.join(workspaceRoot, 'scripts');
    await fs.mkdir(shellCwd, { recursive: true });

    const child = createMockChild();
    const kill = vi.fn((signal?: NodeJS.Signals) => {
      child.stdout.end();
      child.stderr.end();
      child.emit('close', null, signal ?? 'SIGKILL');
      return true;
    });
    child.kill = kill;

    const spawnImpl = vi.fn(() => child as never) as unknown as SpawnImpl;

    const args: RunPwshArgs = {
      command: 'Start-Sleep -Seconds 5',
      cwd: 'scripts',
      timeoutMs: 20
    };

    const promise = executeRunPwsh(args, makeShellConfig(workspaceRoot), { spawnImpl, now: Date.now });

    child.stdout.write('partial stdout');
    child.stderr.write('partial stderr');

    await expect(promise).rejects.toMatchObject({
      code: 'PWSH_TIMEOUT',
      details: {
        cwd: shellCwd,
        timedOut: true,
        signal: 'SIGKILL',
        output: {
          stdout: { text: expect.stringContaining('partial stdout') },
          stderr: { text: expect.stringContaining('partial stderr') }
        }
      }
    });
    expect(kill).toHaveBeenCalledWith('SIGKILL');
  });
});

async function createWorkspaceRoot(): Promise<string> {
  const tmpRoot = path.join(process.cwd(), 'tmp');
  await fs.mkdir(tmpRoot, { recursive: true });
  const root = await fs.mkdtemp(path.join(tmpRoot, 'cwmb-shell-runtime-'));
  tempRoots.push(root);
  return root;
}

function makeShellConfig(workspaceRoot: string, overrides: Partial<{
  shell: 'pwsh' | 'powershell.exe';
  maxGatewayResultChars: number;
}> = {}) {
  return {
    workspaceRoot,
    blockedPaths: [],
    shell: 'pwsh',
    maxGatewayResultChars: 120,
    ...overrides
  };
}

interface MockChild extends EventEmitter {
  stdin: Writable;
  stdout: PassThrough;
  stderr: PassThrough;
  kill: (signal?: NodeJS.Signals) => boolean;
}

function createMockChild(): MockChild {
  const child = new EventEmitter() as MockChild;
  child.stdin = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    }
  });
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => true;
  return child;
}
