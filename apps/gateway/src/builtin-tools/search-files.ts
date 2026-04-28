import { z } from 'zod';
import type { LocalTool } from '../tool-registry/local-tool.js';
import { createWorkspacePathPolicy, resolveBuiltinToolPath } from './workspace-policy.js';
import { hasRg, runRgPathFilter } from './rg-runtime.js';
import { matchesOptionalGlob, walkWorkspaceFiles } from './workspace-search.js';

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
    const policy = createWorkspacePathPolicy(ctx.config);
    const candidatePaths = (await listCandidatePaths(args, normalizedQuery, policy))
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

async function listCandidatePaths(
  args: SearchFilesArgs,
  normalizedQuery: string,
  policy: ReturnType<typeof createWorkspacePathPolicy>
): Promise<string[]> {
  if (await hasRg()) {
    try {
      return await listCandidatePathsWithRg(args, normalizedQuery, policy);
    } catch {
      return listCandidatePathsWithNode(args, normalizedQuery, policy);
    }
  }

  return listCandidatePathsWithNode(args, normalizedQuery, policy);
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
  policy: ReturnType<typeof createWorkspacePathPolicy>
): Promise<string[]> {
  const listArgs = ['--files', '--hidden'];
  if (args.glob) {
    listArgs.push('-g', args.glob);
  }

  const stdout = await runRgPathFilter({
    cwd: policy.workspaceRoot,
    listArgs,
    filterArgs: ['--fixed-strings', '--ignore-case', args.query]
  });
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const matches: string[] = [];

  for (const line of lines) {
    const safePath = await resolveBuiltinCandidatePath(line, policy);
    if (!safePath || !matchesOptionalGlob(safePath, args.glob) || !matchesPathQuery(safePath, normalizedQuery)) {
      continue;
    }

    matches.push(safePath);
  }

  return matches;
}

async function listCandidatePathsWithNode(
  args: SearchFilesArgs,
  normalizedQuery: string,
  policy: ReturnType<typeof createWorkspacePathPolicy>
): Promise<string[]> {
  const matches: string[] = [];
  await walkWorkspaceFiles(policy, (entry) => {
    if (matchesOptionalGlob(entry.relativePath, args.glob) && matchesPathQuery(entry.relativePath, normalizedQuery)) {
      matches.push(entry.relativePath);
    }
  });
  return matches;
}

async function resolveBuiltinCandidatePath(
  line: string,
  policy: ReturnType<typeof createWorkspacePathPolicy>
): Promise<string | null> {
  try {
    const { relativePath } = await resolveBuiltinToolPath(line, policy);
    return relativePath;
  } catch {
    return null;
  }
}
