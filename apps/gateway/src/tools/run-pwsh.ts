import { z } from 'zod';
import { AppError } from '@cwmb/shared';
import type { LocalTool } from './index.js';

const RunPwshArgsSchema = z.object({
  command: z.string().min(1).max(2000),
  cwd: z.string().default('.'),
  timeoutMs: z.number().int().min(1000).max(300000).default(120000)
});

type RunPwshArgs = z.infer<typeof RunPwshArgsSchema>;

export const runPwshTool: LocalTool<RunPwshArgs, never> = {
  name: 'run_pwsh',
  title: 'Run PowerShell',
  description: 'P1 placeholder. Restricted pwsh execution is disabled in v0.1.',
  risk: 'high',
  requiresConfirmation: true,
  enabled: false,
  argsSchema: RunPwshArgsSchema,
  async run() {
    throw new AppError('PWSH_DISABLED', 'run_pwsh is disabled in v0.1.');
  }
};
