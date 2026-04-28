import path from 'node:path';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { AppError } from '@cwmb/shared-utils';
import type { GatewayConfig } from '../config.js';
import type { LocalTool } from '../tools/index.js';
import { resolveWorkspacePath } from '../tool-policy/path-policy.js';
import {
  DEFAULT_SHELL_TIMEOUT_MS,
  MAX_SHELL_COMMAND_CHARS,
  MAX_SHELL_TIMEOUT_MS,
  MIN_SHELL_TIMEOUT_MS,
  normalizeConfiguredShell
} from './config.js';
import { collectShellOutputWarnings, shapeCapturedShellOutput } from './output.js';
import type { ShellCommandOutcome, SpawnImpl, SupportedShell } from './types.js';

export const RunPwshArgsSchema = z.object({
  command: z.string().min(1).max(MAX_SHELL_COMMAND_CHARS),
  cwd: z.string().min(1).default('.'),
  timeoutMs: z.number().int().min(MIN_SHELL_TIMEOUT_MS).max(MAX_SHELL_TIMEOUT_MS).default(DEFAULT_SHELL_TIMEOUT_MS)
});

export type RunPwshArgs = z.infer<typeof RunPwshArgsSchema>;
export type RunPwshResult = ShellCommandOutcome;

interface ShellRuntimeConfig {
  workspaceRoot: string;
  blockedPaths: string[];
  shell: string | undefined;
  maxGatewayResultChars: number;
}

interface PreparedRunPwshExecution {
  shell: SupportedShell;
  command: string;
  cwd: string;
  timeoutMs: number;
  spawnArgs: string[];
  env: NodeJS.ProcessEnv;
}

interface ExecuteRunPwshOptions {
  spawnImpl?: SpawnImpl;
  now?: () => number;
  envSource?: NodeJS.ProcessEnv;
}

export const runPwshTool: LocalTool<RunPwshArgs, RunPwshResult> = {
  name: 'run_pwsh',
  title: 'Run PowerShell',
  description: 'Restricted PowerShell execution. Disabled unless allowPwsh=true.',
  risk: 'high',
  requiresConfirmation: true,
  enabled: false,
  exampleArgs: {
    command: 'pnpm test',
    cwd: '.'
  },
  argsSchema: RunPwshArgsSchema,
  async run(args, ctx) {
    return executeRunPwsh(args, ctx.config);
  }
};

export async function executeRunPwsh(
  input: RunPwshArgs,
  config: ShellRuntimeConfig,
  options: ExecuteRunPwshOptions = {}
): Promise<RunPwshResult> {
  const prepared = await prepareRunPwshExecution(input, config, options.envSource);
  const spawnImpl = options.spawnImpl ?? spawn;
  const now = options.now ?? Date.now;
  const started = now();

  return new Promise((resolve, reject) => {
    const child = spawnImpl(prepared.shell, prepared.spawnArgs, {
      cwd: prepared.cwd,
      env: prepared.env,
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, prepared.timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      finalize({
        exitCode: null,
        signal: null,
        failure: new AppError(
          'PWSH_UNAVAILABLE',
          `Configured shell ${prepared.shell} is not available.`,
          buildOutcome({
            shell: prepared.shell,
            command: prepared.command,
            cwd: prepared.cwd,
            exitCode: null,
            signal: null,
            timedOut: false,
            durationMs: now() - started,
            stdout,
            stderr,
            maxGatewayResultChars: config.maxGatewayResultChars
          })
        )
      });

      if (!settled) {
        reject(error);
      }
    });

    child.on('close', (code, signal) => {
      const exitCode = typeof code === 'number' ? code : null;
      const outcome = buildOutcome({
        shell: prepared.shell,
        command: prepared.command,
        cwd: prepared.cwd,
        exitCode,
        signal,
        timedOut,
        durationMs: now() - started,
        stdout,
        stderr,
        maxGatewayResultChars: config.maxGatewayResultChars
      });

      if (timedOut) {
        finalize({
          exitCode,
          signal,
          failure: new AppError('PWSH_TIMEOUT', `PowerShell timed out after ${prepared.timeoutMs}ms.`, outcome)
        });
        return;
      }

      if (exitCode !== 0) {
        finalize({
          exitCode,
          signal,
          failure: new AppError('PWSH_EXIT_NONZERO', `PowerShell exited with code ${exitCode}.`, outcome)
        });
        return;
      }

      finalize({ exitCode, signal, outcome });
    });

    function finalize(result: {
      exitCode: number | null;
      signal: NodeJS.Signals | null;
      outcome?: ShellCommandOutcome;
      failure?: AppError;
    }): void {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);

      if (result.failure) {
        reject(result.failure);
        return;
      }

      resolve(result.outcome as ShellCommandOutcome);
    }
  });
}

export async function prepareRunPwshExecution(
  input: RunPwshArgs,
  config: Pick<ShellRuntimeConfig, 'workspaceRoot' | 'blockedPaths' | 'shell'>,
  envSource: NodeJS.ProcessEnv = process.env
): Promise<PreparedRunPwshExecution> {
  const args = guardRunPwshInput(input);
  const resolvedCwd = await resolveWorkspacePath(args.cwd, {
    workspaceRoot: config.workspaceRoot,
    blockedPatterns: config.blockedPaths
  });
  const workspaceRoot = path.resolve(config.workspaceRoot);

  return {
    shell: normalizeConfiguredShell(config.shell),
    command: args.command,
    cwd: resolvedCwd.absolutePath,
    timeoutMs: args.timeoutMs,
    spawnArgs: ['-NoProfile', '-NonInteractive', '-Command', args.command],
    env: createShellEnvironment({
      baseEnv: envSource,
      workspaceRoot,
      cwd: resolvedCwd.absolutePath
    })
  };
}

export function guardRunPwshInput(input: RunPwshArgs): RunPwshArgs {
  const command = input.command.trim();
  if (!command) {
    throw new AppError('INVALID_SHELL_COMMAND', 'PowerShell command must not be empty.');
  }

  if (command.includes('\0')) {
    throw new AppError('INVALID_SHELL_COMMAND', 'PowerShell command must not contain null bytes.');
  }

  if (input.cwd.includes('\0')) {
    throw new AppError('INVALID_PATH', 'Invalid PowerShell working directory.');
  }

  return {
    command,
    cwd: input.cwd,
    timeoutMs: input.timeoutMs
  };
}

export function createShellEnvironment(input: {
  baseEnv: NodeJS.ProcessEnv;
  workspaceRoot: string;
  cwd: string;
}): NodeJS.ProcessEnv {
  return {
    ...input.baseEnv,
    CWMB_WORKSPACE_ROOT: input.workspaceRoot,
    NO_COLOR: '1',
    PWD: input.cwd,
    TERM: 'dumb'
  };
}

function buildOutcome(input: {
  shell: SupportedShell;
  command: string;
  cwd: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  maxGatewayResultChars: number;
}): ShellCommandOutcome {
  const output = shapeCapturedShellOutput(input.stdout, input.stderr, input.maxGatewayResultChars);

  return {
    shell: input.shell,
    command: input.command,
    cwd: input.cwd,
    exitCode: input.exitCode,
    signal: input.signal,
    timedOut: input.timedOut,
    durationMs: input.durationMs,
    output,
    warnings: collectShellOutputWarnings(output)
  };
}
