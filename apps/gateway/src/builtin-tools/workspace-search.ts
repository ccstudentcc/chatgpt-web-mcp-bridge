import fs from 'node:fs/promises';
import path from 'node:path';
import { minimatch } from 'minimatch';
import { resolveWorkspacePath, type PathPolicy } from '../tool-policy/path-policy.js';
import { ignoredDirectories } from '../tool-policy/path-policy.js';

export interface WorkspaceFileEntry {
  absolutePath: string;
  relativePath: string;
}

export async function walkWorkspaceFiles(
  policy: PathPolicy,
  visit: (entry: WorkspaceFileEntry) => Promise<void> | void
): Promise<void> {
  const root = await resolveWorkspacePath('.', policy);
  await walk(root.absolutePath);

  async function walk(currentAbsolutePath: string): Promise<void> {
    const items = await fs.readdir(currentAbsolutePath, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory() && ignoredDirectories.has(item.name)) {
        continue;
      }

      const absolutePath = path.join(currentAbsolutePath, item.name);
      const relativeInput = path.relative(policy.workspaceRoot, absolutePath);

      let safePath: WorkspaceFileEntry;
      try {
        safePath = await resolveWorkspacePath(relativeInput, policy);
      } catch {
        continue;
      }

      if (item.isDirectory()) {
        await walk(safePath.absolutePath);
        continue;
      }

      await visit(safePath);
    }
  }
}

export function matchesOptionalGlob(relativePath: string, glob?: string): boolean {
  if (!glob) {
    return true;
  }

  return minimatch(relativePath, glob, { nocase: true, dot: true });
}
