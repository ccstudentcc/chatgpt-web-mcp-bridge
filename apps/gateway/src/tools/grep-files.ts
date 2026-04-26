import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { AppError, assessSensitiveTextContent } from '@cwmb/shared';
import type { LocalTool } from './index.js';
import { matchesOptionalGlob, walkWorkspaceFiles } from './search-helpers.js';
import { resolveWorkspacePath } from '../security/path-policy.js';
import { hasRg } from '../utils/find-rg.js';

const GrepFilesArgsSchema = z.object({
  mode: z.enum(['literal', 'regex']).default('literal'),
  query: z.string().min(1).optional(),
  patterns: z.array(z.string().min(1)).min(1).optional(),
  match: z.enum(['any', 'all']).default('any'),
  glob: z.string().optional(),
  maxResults: z.number().int().min(1).max(500).default(100),
  caseSensitive: z.boolean().default(false),
  context: z.number().int().min(0).max(5).default(2)
}).superRefine((args, ctx) => {
  const hasQuery = typeof args.query === 'string';
  const hasPatterns = Array.isArray(args.patterns);

  if (hasQuery === hasPatterns) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide exactly one of query or patterns.'
    });
  }

  if (args.mode === 'regex' && hasPatterns) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Regex mode only supports query, not patterns.'
    });
  }

  if (hasQuery && args.match !== 'any') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'match is only supported with patterns.'
    });
  }
});

type GrepFilesArgs = z.infer<typeof GrepFilesArgsSchema>;

export interface GrepMatch {
  path: string;
  line: number;
  text: string;
  before: string[];
  after: string[];
}

type GrepEngine = 'rg' | 'node-fallback';

export interface GrepFilesResult {
  modeUsed: 'literal' | 'regex';
  engine: GrepEngine;
  interpretedAs: {
    query: string | null;
    patterns: string[] | null;
    match: 'any' | 'all' | null;
  };
  matches: GrepMatch[];
  totalMatches: number;
  returnedMatches: number;
  truncated: boolean;
  warnings: string[];
}

export const grepFilesTool: LocalTool<GrepFilesArgs, GrepFilesResult> = {
  name: 'grep_files',
  title: 'Grep files',
  description: 'Search text content in workspace files with literal or explicit regex mode, block high-confidence secrets, and redact lower-confidence assignment-like values.',
  risk: 'low',
  requiresConfirmation: false,
  enabled: true,
  exampleArgs: {
    query: 'TODO',
    glob: '**/*.{ts,tsx,md}',
    maxResults: 20
  },
  argsSchema: GrepFilesArgsSchema,
  async run(args, ctx) {
    const plan = createSearchPlan(args);
    const matches: GrepMatch[] = [];
    const warnings = new Set<string>();
    let truncated = false;
    let totalMatches = 0;
    const candidateFiles = await listCandidateFiles(plan, args, ctx.config.workspaceRoot, ctx.config.blockedPaths);

    for (const entry of candidateFiles.paths) {
      const stat = await fs.stat(entry.absolutePath);
      if (stat.size > ctx.config.maxFileSizeBytes) {
        continue;
      }

      const buf = await fs.readFile(entry.absolutePath);
      if (buf.includes(0)) {
        continue;
      }

      const lines = buf.toString('utf8').split(/\r?\n/);
      const fileMatches = collectMatchingLineNumbers(lines, plan);
      totalMatches += fileMatches.length;

      for (const lineIndex of fileMatches) {
        if (matches.length >= args.maxResults) {
          truncated = true;
          continue;
        }

        const line = lines[lineIndex] ?? '';
        const redactedLine = withSensitiveContentPolicy(line, warnings);
        const before = lines
          .slice(Math.max(0, lineIndex - args.context), lineIndex)
          .map((contextLine) => withSensitiveContentPolicy(contextLine, warnings));
        const after = lines
          .slice(lineIndex + 1, lineIndex + 1 + args.context)
          .map((contextLine) => withSensitiveContentPolicy(contextLine, warnings));

        matches.push({
          path: entry.relativePath,
          line: lineIndex + 1,
          text: redactedLine,
          before,
          after
        });
      }
    }

    if (truncated) {
      warnings.add('Result limit reached. Narrow query, patterns, glob, or context.');
    }

    return {
      modeUsed: plan.modeUsed,
      engine: candidateFiles.engine,
      interpretedAs: plan.interpretedAs,
      matches,
      totalMatches,
      returnedMatches: matches.length,
      truncated,
      warnings: [...warnings]
    };
  }
};

function withSensitiveContentPolicy(line: string, warnings: Set<string>): string {
  const sensitive = assessSensitiveTextContent(line);
  if (sensitive.blocked) {
    throw new AppError('SENSITIVE_CONTENT_BLOCKED', 'Potential secret-like content was detected.');
  }

  if (sensitive.redacted) {
    warnings.add('Potential secret-like content was redacted.');
  }

  return sensitive.content;
}

type SearchPlan =
  | {
    modeUsed: 'literal';
    matcher: (line: string) => boolean;
    normalizeLine: (line: string) => string;
    matchStrategy: 'query' | 'patterns-any' | 'patterns-all';
    patternCount: number;
    normalizedPatterns: string[] | null;
    interpretedAs: GrepFilesResult['interpretedAs'];
  }
  | {
    modeUsed: 'regex';
    matcher: (line: string) => boolean;
    interpretedAs: GrepFilesResult['interpretedAs'];
  };

interface CandidateFile {
  absolutePath: string;
  relativePath: string;
}

function createSearchPlan(args: GrepFilesArgs): SearchPlan {
  if (args.mode === 'regex') {
    try {
      const regex = new RegExp(args.query ?? '', args.caseSensitive ? '' : 'i');
      return {
        modeUsed: 'regex',
        matcher: (line) => regex.test(line),
        interpretedAs: {
          query: args.query ?? null,
          patterns: null,
          match: null
        }
      };
    } catch (error) {
      throw new AppError('INVALID_ARGS', `Invalid regex query: ${(error as Error).message}`);
    }
  }

  if (args.query) {
    const normalizeLine = args.caseSensitive
      ? (line: string) => line
      : (line: string) => line.toLowerCase();
    const needle = args.caseSensitive ? args.query : args.query.toLowerCase();
    return {
      modeUsed: 'literal',
      matcher: (line) => normalizeLine(line).includes(needle),
      normalizeLine,
      matchStrategy: 'query',
      patternCount: 1,
      normalizedPatterns: null,
      interpretedAs: {
        query: args.query,
        patterns: null,
        match: null
      }
    };
  }

  const patterns = args.patterns ?? [];
  const needles = args.caseSensitive ? patterns : patterns.map((pattern) => pattern.toLowerCase());
  const normalizeLine = args.caseSensitive
    ? (line: string) => line
    : (line: string) => line.toLowerCase();
  return {
    modeUsed: 'literal',
    matcher: (line) => needles.some((needle) => normalizeLine(line).includes(needle)),
    normalizeLine,
    matchStrategy: args.match === 'all' ? 'patterns-all' : 'patterns-any',
    patternCount: needles.length,
    normalizedPatterns: needles,
    interpretedAs: {
      query: null,
      patterns,
      match: args.match
    }
  };
}

function collectMatchingLineNumbers(lines: string[], plan: SearchPlan): number[] {
  if (plan.modeUsed === 'regex' || plan.matchStrategy !== 'patterns-all') {
    const matches: number[] = [];
    for (let index = 0; index < lines.length; index += 1) {
      if (plan.matcher(lines[index] ?? '')) {
        matches.push(index);
      }
    }
    return matches;
  }

  const matches: number[] = [];
  const matchedPatterns = new Set<string>();
  const needles = plan.normalizedPatterns ?? [];

  for (let index = 0; index < lines.length; index += 1) {
    const haystack = plan.normalizeLine(lines[index] ?? '');
    let lineMatched = false;

    for (const needle of needles) {
      if (haystack.includes(needle)) {
        matchedPatterns.add(needle);
        lineMatched = true;
      }
    }

    if (lineMatched) {
      matches.push(index);
    }
  }

  return matchedPatterns.size === plan.patternCount ? matches : [];
}

async function listCandidateFiles(
  plan: SearchPlan,
  args: GrepFilesArgs,
  workspaceRoot: string,
  blockedPatterns: string[]
): Promise<{ engine: GrepEngine; paths: CandidateFile[] }> {
  if (plan.modeUsed === 'literal' && await hasRg()) {
    try {
      return {
        engine: 'rg',
        paths: await listCandidateFilesWithRg(plan, args, workspaceRoot, blockedPatterns)
      };
    } catch {
      return {
        engine: 'node-fallback',
        paths: await listCandidateFilesWithNode(args, workspaceRoot, blockedPatterns)
      };
    }
  }

  return {
    engine: 'node-fallback',
    paths: await listCandidateFilesWithNode(args, workspaceRoot, blockedPatterns)
  };
}

async function listCandidateFilesWithRg(
  plan: Extract<SearchPlan, { modeUsed: 'literal' }>,
  args: GrepFilesArgs,
  workspaceRoot: string,
  blockedPatterns: string[]
): Promise<CandidateFile[]> {
  const rgArgs = ['-l', '--hidden', '--no-messages'];
  if (!args.caseSensitive) {
    rgArgs.push('--ignore-case');
  }
  if (args.glob) {
    rgArgs.push('-g', args.glob);
  }
  rgArgs.push('--fixed-strings');

  if (plan.interpretedAs.query) {
    rgArgs.push('-e', plan.interpretedAs.query);
  } else {
    for (const pattern of plan.interpretedAs.patterns ?? []) {
      rgArgs.push('-e', pattern);
    }
  }
  rgArgs.push('.');

  const stdout = await runRgFileSearch(rgArgs, workspaceRoot);
  const matches = new Map<string, CandidateFile>();
  for (const line of stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
    try {
      const safePath = await resolveWorkspacePath(line, { workspaceRoot, blockedPatterns });
      matches.set(safePath.relativePath, safePath);
    } catch {
      continue;
    }
  }

  return [...matches.values()].sort(compareCandidateFiles);
}

async function listCandidateFilesWithNode(
  args: GrepFilesArgs,
  workspaceRoot: string,
  blockedPatterns: string[]
): Promise<CandidateFile[]> {
  const matches: CandidateFile[] = [];
  await walkWorkspaceFiles({ workspaceRoot, blockedPatterns }, (entry) => {
    if (matchesOptionalGlob(entry.relativePath, args.glob)) {
      matches.push(entry);
    }
  });
  return matches.sort(compareCandidateFiles);
}

function compareCandidateFiles(left: CandidateFile, right: CandidateFile): number {
  return left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: 'base' });
}

async function runRgFileSearch(args: string[], cwd: string): Promise<string> {
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
    child.on('error', (error) => reject(error as Error));
    child.on('close', (code) => {
      if (code === 0 || code === 1) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr || `rg exited with code ${code}`));
    });
  });
}
