import fs from 'node:fs/promises';
import { z } from 'zod';
import { AppError, hasSecretLikeContent } from '@cwmb/shared';
import type { LocalTool } from './index.js';
import { resolveWorkspacePath } from '../security/path-policy.js';

const ReadFileArgsSchema = z.object({
  path: z.string().min(1),
  encoding: z.literal('utf-8').default('utf-8')
});

type ReadFileArgs = z.infer<typeof ReadFileArgsSchema>;

export interface ReadFileResult {
  path: string;
  sizeBytes: number;
  encoding: 'utf-8';
  content: string;
  truncated: boolean;
}

export const readFileTool: LocalTool<ReadFileArgs, ReadFileResult> = {
  name: 'read_file',
  title: 'Read file',
  description: 'Read a UTF-8 text file under the configured workspace root.',
  risk: 'low',
  requiresConfirmation: false,
  enabled: true,
  exampleArgs: {
    path: 'README.md'
  },
  argsSchema: ReadFileArgsSchema,
  async run(args, ctx) {
    const resolved = await resolveWorkspacePath(args.path, {
      workspaceRoot: ctx.config.workspaceRoot,
      blockedPatterns: ctx.config.blockedPaths
    });

    const stat = await fs.stat(resolved.absolutePath);
    if (stat.isDirectory()) {
      throw new AppError('INVALID_ARGS', 'read_file expects a file path, not a directory.');
    }
    if (stat.size > ctx.config.maxFileSizeBytes) {
      throw new AppError('FILE_TOO_LARGE', `File exceeds maxFileSizeBytes (${ctx.config.maxFileSizeBytes}).`);
    }

    const buffer = await fs.readFile(resolved.absolutePath);
    if (looksBinary(buffer)) {
      throw new AppError('BINARY_FILE_REJECTED', 'Binary files are rejected.');
    }

    const content = buffer.toString(args.encoding);
    if (hasSecretLikeContent(content)) {
      throw new AppError('SENSITIVE_CONTENT_BLOCKED', 'Potential secret-like content was detected.');
    }

    return {
      path: resolved.relativePath,
      sizeBytes: stat.size,
      encoding: args.encoding,
      content,
      truncated: false
    };
  }
};

function looksBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  return sample.includes(0);
}
