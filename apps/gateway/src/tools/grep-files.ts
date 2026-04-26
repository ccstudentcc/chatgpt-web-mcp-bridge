import fs from 'node:fs/promises';
import { z } from 'zod';
import { AppError, assessSensitiveTextContent } from '@cwmb/shared';
import type { LocalTool } from './index.js';
import { matchesOptionalGlob, walkWorkspaceFiles } from './search-helpers.js';

const GrepFilesArgsSchema = z.object({
  pattern: z.string().min(1),
  glob: z.string().optional(),
  maxResults: z.number().int().min(1).max(500).default(100),
  caseSensitive: z.boolean().default(false),
  context: z.number().int().min(0).max(5).default(2)
});

type GrepFilesArgs = z.infer<typeof GrepFilesArgsSchema>;
export interface GrepMatch {
  path: string;
  line: number;
  text: string;
  before: string[];
  after: string[];
}
export interface GrepFilesResult {
  pattern: string;
  matches: GrepMatch[];
  totalMatches: number;
  returnedMatches: number;
  truncated: boolean;
  warnings: string[];
}

export const grepFilesTool: LocalTool<GrepFilesArgs, GrepFilesResult> = {
  name: 'grep_files',
  title: 'Grep files',
  description: 'Search text content in workspace files, block high-confidence secrets, and redact lower-confidence assignment-like values.',
  risk: 'low',
  requiresConfirmation: false,
  enabled: true,
  exampleArgs: {
    pattern: 'TODO',
    glob: '**/*.{ts,tsx,md}',
    maxResults: 20
  },
  argsSchema: GrepFilesArgsSchema,
  async run(args, ctx) {
    const matches: GrepMatch[] = [];
    const warnings = new Set<string>();
    let truncated = false;
    let totalMatches = 0;
    const needle = args.caseSensitive ? args.pattern : args.pattern.toLowerCase();

    await walkWorkspaceFiles(
      { workspaceRoot: ctx.config.workspaceRoot, blockedPatterns: ctx.config.blockedPaths },
      async (entry) => {
        if (!matchesOptionalGlob(entry.relativePath, args.glob)) {
          return;
        }

        const stat = await fs.stat(entry.absolutePath);
        if (stat.size > ctx.config.maxFileSizeBytes) {
          return;
        }

        const buf = await fs.readFile(entry.absolutePath);
        if (buf.includes(0)) {
          return;
        }

        const lines = buf.toString('utf8').split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i] ?? '';
          const haystack = args.caseSensitive ? line : line.toLowerCase();
          if (!haystack.includes(needle)) {
            continue;
          }

          totalMatches += 1;
          if (matches.length >= args.maxResults) {
            truncated = true;
            continue;
          }

          const redactedLine = withSensitiveContentPolicy(line, warnings);
          const before = lines
            .slice(Math.max(0, i - args.context), i)
            .map((contextLine) => withSensitiveContentPolicy(contextLine, warnings));
          const after = lines
            .slice(i + 1, i + 1 + args.context)
            .map((contextLine) => withSensitiveContentPolicy(contextLine, warnings));

          matches.push({
            path: entry.relativePath,
            line: i + 1,
            text: redactedLine,
            before,
            after
          });
        }
      }
    );

    if (truncated) {
      warnings.add('Result limit reached. Narrow pattern, glob, or context.');
    }

    return {
      pattern: args.pattern,
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
