import path from 'node:path';
import { minimatch } from 'minimatch';

export function matchesBlockedPath(relativePath: string, blockedPatterns: string[]): boolean {
  const normalized = relativePath.split(path.sep).join('/');
  return blockedPatterns.some((pattern) => minimatch(normalized, pattern, { nocase: true, dot: true }));
}

export const ignoredDirectories = new Set(['node_modules', '.git', 'dist', 'build', '.cache', 'coverage']);
