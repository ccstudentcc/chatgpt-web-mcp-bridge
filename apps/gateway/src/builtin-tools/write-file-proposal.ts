import { z } from 'zod';
import { AppError } from '@cwmb/shared-utils';
import type { LocalTool } from '../tool-registry/local-tool.js';

const WriteFileProposalArgsSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  mode: z.enum(['replace']).default('replace')
});

type WriteFileProposalArgs = z.infer<typeof WriteFileProposalArgsSchema>;

export const writeFileProposalTool: LocalTool<WriteFileProposalArgs, never> = {
  name: 'write_file_proposal',
  title: 'Write file proposal',
  description: 'P1 placeholder. Generate a diff proposal before writing files.',
  risk: 'medium',
  requiresConfirmation: true,
  enabled: false,
  exampleArgs: {
    path: 'docs/prd.md',
    content: '# Updated content',
    mode: 'replace'
  },
  argsSchema: WriteFileProposalArgsSchema,
  async run() {
    throw new AppError('TOOL_DISABLED', 'write_file_proposal is reserved for P1 and disabled in v0.1.');
  }
};
