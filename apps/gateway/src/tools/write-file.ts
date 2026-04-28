import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { AppError } from '@cwmb/shared';
import type { LocalTool } from './index.js';
import { resolveWorkspacePath } from '../security/path-policy.js';
import { assertWriteEnabled } from '../tool-policy/index.js';

const WriteFileArgsSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  mode: z.enum(['replace', 'create']).default('replace')
});

type WriteFileArgs = z.infer<typeof WriteFileArgsSchema>;

export interface WriteFileResult {
  path: string;
  mode: 'replace' | 'create';
  bytesWritten: number;
  charsWritten: number;
}

export const writeFileTool: LocalTool<WriteFileArgs, WriteFileResult> = {
  name: 'write_file',
  title: 'Write file',
  description: 'Write a UTF-8 text file under workspaceRoot. High risk; requires explicit enablement and confirmation.',
  risk: 'high',
  requiresConfirmation: true,
  enabled: false,
  exampleArgs: {
    path: 'docs/example.md',
    content: '# Updated content',
    mode: 'replace'
  },
  argsSchema: WriteFileArgsSchema,
  async run(args, ctx) {
    assertWriteEnabled(ctx.config.allowWrite);

    const resolved = await resolveWorkspacePath(args.path, {
      workspaceRoot: ctx.config.workspaceRoot,
      blockedPatterns: ctx.config.blockedPaths
    });

    if (args.mode === 'create') {
      try {
        await fs.stat(resolved.absolutePath);
        throw new AppError('FILE_EXISTS', 'File already exists. Use mode=replace to overwrite it.');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    }

    await fs.mkdir(path.dirname(resolved.absolutePath), { recursive: true });
    await fs.writeFile(resolved.absolutePath, args.content, 'utf8');

    return {
      path: resolved.relativePath,
      mode: args.mode,
      bytesWritten: Buffer.byteLength(args.content, 'utf8'),
      charsWritten: args.content.length
    };
  }
};
