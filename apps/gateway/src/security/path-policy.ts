import fs from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '@cwmb/shared';
import { matchesBlockedPath } from './sensitive-paths.js';

export interface PathPolicy {
  workspaceRoot: string;
  blockedPatterns: string[];
}

export interface ResolvedWorkspacePath {
  absolutePath: string;
  relativePath: string;
}

export async function resolveWorkspacePath(inputPath: string, policy: PathPolicy): Promise<ResolvedWorkspacePath> {
  if (!policy.workspaceRoot) {
    throw new AppError('WORKSPACE_NOT_CONFIGURED', 'workspaceRoot is required before calling local tools.');
  }

  if (!inputPath || inputPath.includes('\0')) {
    throw new AppError('INVALID_PATH', 'Invalid path.');
  }

  if (isUncPath(inputPath)) {
    throw new AppError('PATH_OUTSIDE_WORKSPACE', 'UNC paths are not allowed by default.');
  }

  const root = path.resolve(policy.workspaceRoot);
  const realRoot = await realpathIfExists(root);
  const resolved = path.resolve(realRoot, inputPath);
  const realResolved = await realpathIfExists(resolved);

  if (!isSubPath(realResolved, realRoot)) {
    throw new AppError('PATH_OUTSIDE_WORKSPACE', 'The requested path is outside workspaceRoot.');
  }

  const relativePath = path.relative(realRoot, realResolved).split(path.sep).join('/');
  if (matchesBlockedPath(relativePath, policy.blockedPatterns)) {
    throw new AppError('BLOCKED_PATH', 'The requested path is blocked by security policy.');
  }

  return { absolutePath: realResolved, relativePath: relativePath || '.' };
}

export function isSubPath(candidate: string, root: string): boolean {
  const normalizedRoot = normalizeForCompare(root);
  const normalizedCandidate = normalizeForCompare(candidate);
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`);
}

async function realpathIfExists(inputPath: string): Promise<string> {
  try {
    return await fs.realpath(inputPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return path.resolve(inputPath);
    }
    throw err;
  }
}

function normalizeForCompare(inputPath: string): string {
  const resolved = path.resolve(inputPath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isUncPath(inputPath: string): boolean {
  return inputPath.startsWith('\\\\') || inputPath.startsWith('//');
}
