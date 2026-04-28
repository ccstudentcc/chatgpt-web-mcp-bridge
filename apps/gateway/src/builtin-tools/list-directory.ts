import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { LocalTool } from '../tools/index.js';
import { ignoredDirectories } from '../security/sensitive-paths.js';
import { createWorkspacePathPolicy, resolveBuiltinToolPath } from './workspace-policy.js';

const ListDirectoryArgsSchema = z.object({
  path: z.string().default('.'),
  maxDepth: z.number().int().min(0).max(5).default(2),
  maxEntries: z.number().int().min(1).max(1000).default(200)
});

type ListDirectoryArgs = z.infer<typeof ListDirectoryArgsSchema>;

export interface DirectoryEntry {
  path: string;
  type: 'file' | 'directory';
  sizeBytes?: number;
}

export interface ListDirectoryResult {
  root: string;
  entries: DirectoryEntry[];
  truncated: boolean;
}

export const listDirectoryTool: LocalTool<ListDirectoryArgs, ListDirectoryResult> = {
  name: 'list_directory',
  title: 'List directory',
  description: 'List files and directories under the configured workspace root.',
  risk: 'low',
  requiresConfirmation: false,
  enabled: true,
  exampleArgs: {
    path: '.',
    maxDepth: 2
  },
  argsSchema: ListDirectoryArgsSchema,
  async run(args, ctx) {
    const root = await resolveBuiltinToolPath(args.path, ctx.config);
    const policy = createWorkspacePathPolicy(ctx.config);
    const entries: DirectoryEntry[] = [];
    let truncated = false;

    async function walk(abs: string, depth: number): Promise<void> {
      if (entries.length >= args.maxEntries) {
        truncated = true;
        return;
      }
      if (depth > args.maxDepth) {
        return;
      }

      const items = await fs.readdir(abs, { withFileTypes: true });
      for (const item of items) {
        if (entries.length >= args.maxEntries) {
          truncated = true;
          return;
        }
        if (item.isDirectory() && ignoredDirectories.has(item.name)) {
          continue;
        }

        const itemAbs = path.join(abs, item.name);
        const safe = await resolveBuiltinToolPath(path.relative(ctx.config.workspaceRoot, itemAbs), policy);
        const stat = await fs.stat(safe.absolutePath);
        entries.push({
          path: safe.relativePath,
          type: stat.isDirectory() ? 'directory' : 'file',
          sizeBytes: stat.isFile() ? stat.size : undefined
        });
        if (stat.isDirectory()) {
          await walk(safe.absolutePath, depth + 1);
        }
      }
    }

    await walk(root.absolutePath, 0);
    return { root: root.relativePath, entries, truncated };
  }
};
