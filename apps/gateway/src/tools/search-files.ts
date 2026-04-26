import { spawn } from 'node:child_process';
import { z } from 'zod';
import type { LocalTool } from './index.js';
import { hasRg } from '../utils/find-rg.js';
import { resolveWorkspacePath } from '../security/path-policy.js';
import { matchesOptionalGlob, walkWorkspaceFiles } from './search-helpers.js';

const SearchFilesArgsSchema = z.object({
  query: z.string().min(1),
  glob: z.string().optional(),
  maxResults: z.number().int().min(1).max(200).default(50)
});

type SearchFilesArgs = z.infer<typeof SearchFilesArgsSchema>;

export interface SearchFilesResult {
  query: string;
  matches: string[];
  totalMatches: number;
  returnedMatches: number;
  truncated: boolean;
}

export const searchFilesTool: LocalTool<SearchFilesArgs, SearchFilesResult> = {
  name: 'search_files',
  title: 'Search files',
  description: 'Search workspace file paths by partial file or path name.',
  risk: 'low',
  requiresConfirmation: false,
  enabled: true,
  exampleArgs: {
    query: 'README',
    maxResults: 20
  },
  argsSchema: SearchFilesArgsSchema,
  async run(args, ctx) {
    const normalizedQuery = args.query.toLowerCase();
    const candidatePaths = (await listCandidatePaths(args, ctx.config.workspaceRoot, ctx.config.blockedPaths))
      .sort(compareCandidatePath);
    const matches: string[] = [];
    let totalMatches = 0;

    for (const candidatePath of candidatePaths) {
      if (!matchesPathQuery(candidatePath, normalizedQuery)) {
        continue;
      }

      totalMatches += 1;
      if (matches.length < args.maxResults) {
        matches.push(candidatePath);
      }
    }

    return {
      query: args.query,
      matches,
      totalMatches,
      returnedMatches: matches.length,
      truncated: totalMatches > matches.length
    };
  }
};

async function listCandidatePaths(args: SearchFilesArgs, workspaceRoot: string, blockedPatterns: string[]): Promise<string[]> {
  const normalizedQuery = args.query.toLowerCase();
  if (await hasRg()) {
    try {
      return await listCandidatePathsWithRg(args, normalizedQuery, workspaceRoot, blockedPatterns);
    } catch {
      return listCandidatePathsWithNode(args, normalizedQuery, workspaceRoot, blockedPatterns);
    }
  }

  return listCandidatePathsWithNode(args, normalizedQuery, workspaceRoot, blockedPatterns);
}

function compareCandidatePath(left: string, right: string): number {
  const depthDifference = depthOfPath(left) - depthOfPath(right);
  if (depthDifference !== 0) {
    return depthDifference;
  }

  const lengthDifference = left.length - right.length;
  if (lengthDifference !== 0) {
    return lengthDifference;
  }

  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function depthOfPath(value: string): number {
  return value.split('/').length;
}

function matchesPathQuery(candidatePath: string, normalizedQuery: string): boolean {
  return candidatePath.toLowerCase().includes(normalizedQuery);
}

async function listCandidatePathsWithRg(
  args: SearchFilesArgs,
  normalizedQuery: string,
  workspaceRoot: string,
  blockedPatterns: string[]
): Promise<string[]> {
  const rgArgs = ['--files', '--hidden'];
  if (args.glob) {
    rgArgs.push('-g', args.glob);
  }

  const stdout = await runRgPathSearch(rgArgs, args.query, workspaceRoot);
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const matches: string[] = [];

  for (const line of lines) {
    const safePath = await resolveWorkspacePath(line, { workspaceRoot, blockedPatterns });
    if (!matchesOptionalGlob(safePath.relativePath, args.glob) || !matchesPathQuery(safePath.relativePath, normalizedQuery)) {
      continue;
    }

    matches.push(safePath.relativePath);
  }

  return matches;
}

async function listCandidatePathsWithNode(
  args: SearchFilesArgs,
  normalizedQuery: string,
  workspaceRoot: string,
  blockedPatterns: string[]
): Promise<string[]> {
  const matches: string[] = [];
  await walkWorkspaceFiles({ workspaceRoot, blockedPatterns }, (entry) => {
    if (matchesOptionalGlob(entry.relativePath, args.glob) && matchesPathQuery(entry.relativePath, normalizedQuery)) {
      matches.push(entry.relativePath);
    }
  });
  return matches;
}

async function runRgPathSearch(listArgs: string[], query: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const listChild = spawn('rg', listArgs, { cwd, windowsHide: true });
    const filterChild = spawn('rg', ['--fixed-strings', '--ignore-case', query], { cwd, windowsHide: true });
    let stdout = '';
    let listStderr = '';
    let filterStderr = '';
    let settled = false;
    let listClosed = false;
    let filterClosed = false;
    let listCode: number | null = null;
    let filterCode: number | null = null;

    function settleWithError(error: Error): void {
      if (settled) return;
      settled = true;
      reject(error);
    }

    function maybeResolve(): void {
      if (settled || !listClosed || !filterClosed) {
        return;
      }

      if (listCode !== 0) {
        settleWithError(new Error(listStderr || `rg --files exited with code ${listCode}`));
        return;
      }

      if (filterCode === 0 || filterCode === 1) {
        settled = true;
        resolve(stdout);
        return;
      }

      settleWithError(new Error(filterStderr || `rg filter exited with code ${filterCode}`));
    }

    listChild.stdout.pipe(filterChild.stdin);
    filterChild.stdin.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code !== 'EPIPE') {
        settleWithError(error as Error);
      }
    });
    filterChild.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    listChild.stderr.on('data', (chunk) => {
      listStderr += String(chunk);
    });
    filterChild.stderr.on('data', (chunk) => {
      filterStderr += String(chunk);
    });
    listChild.on('error', (error) => settleWithError(error as Error));
    filterChild.on('error', (error) => settleWithError(error as Error));
    listChild.on('close', (code) => {
      listClosed = true;
      listCode = code;
      maybeResolve();
    });
    filterChild.on('close', (code) => {
      filterClosed = true;
      filterCode = code;
      maybeResolve();
    });
  });
}
