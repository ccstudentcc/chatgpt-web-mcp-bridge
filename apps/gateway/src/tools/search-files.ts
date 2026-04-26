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
      if (!candidatePath.toLowerCase().includes(normalizedQuery)) {
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
  if (await hasRg()) {
    try {
      return await listCandidatePathsWithRg(args, workspaceRoot, blockedPatterns);
    } catch {
      return listCandidatePathsWithNode(args, workspaceRoot, blockedPatterns);
    }
  }

  return listCandidatePathsWithNode(args, workspaceRoot, blockedPatterns);
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

async function listCandidatePathsWithRg(args: SearchFilesArgs, workspaceRoot: string, blockedPatterns: string[]): Promise<string[]> {
  const rgArgs = ['--files', '--hidden'];
  if (args.glob) {
    rgArgs.push('-g', args.glob);
  }

  const stdout = await runRg(rgArgs, workspaceRoot);
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const matches: string[] = [];

  for (const line of lines) {
    const safePath = await resolveWorkspacePath(line, { workspaceRoot, blockedPatterns });
    if (!matchesOptionalGlob(safePath.relativePath, args.glob)) {
      continue;
    }

    matches.push(safePath.relativePath);
  }

  return matches;
}

async function listCandidatePathsWithNode(args: SearchFilesArgs, workspaceRoot: string, blockedPatterns: string[]): Promise<string[]> {
  const matches: string[] = [];
  await walkWorkspaceFiles({ workspaceRoot, blockedPatterns }, (entry) => {
    if (matchesOptionalGlob(entry.relativePath, args.glob)) {
      matches.push(entry.relativePath);
    }
  });
  return matches;
}

async function runRg(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('rg', args, { cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr || `rg exited with code ${code}`));
    });
  });
}
