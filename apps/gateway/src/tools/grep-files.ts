import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { redactSecretLikeContent } from '@cwmb/shared';
import type { LocalTool } from './index.js';
import { resolveWorkspacePath } from '../security/path-policy.js';
import { ignoredDirectories } from '../security/sensitive-paths.js';

const GrepFilesArgsSchema = z.object({
  pattern: z.string().min(1),
  glob: z.string().optional(),
  maxResults: z.number().int().min(1).max(500).default(100),
  caseSensitive: z.boolean().default(false),
  context: z.number().int().min(0).max(5).default(2)
});

type GrepFilesArgs = z.infer<typeof GrepFilesArgsSchema>;
export interface GrepMatch { path: string; line: number; text: string }
export interface GrepFilesResult { pattern: string; matches: GrepMatch[]; truncated: boolean; warnings: string[] }

export const grepFilesTool: LocalTool<GrepFilesArgs, GrepFilesResult> = {
  name: 'grep_files',
  title: 'Grep files',
  description: 'Search text content in workspace files and redact secret-like values.',
  risk: 'low',
  requiresConfirmation: false,
  enabled: true,
  argsSchema: GrepFilesArgsSchema,
  async run(args, ctx) {
    const root = await resolveWorkspacePath('.', { workspaceRoot: ctx.config.workspaceRoot, blockedPatterns: ctx.config.blockedPaths });
    const matches: GrepMatch[] = [];
    const warnings = new Set<string>();
    let truncated = false;
    const needle = args.caseSensitive ? args.pattern : args.pattern.toLowerCase();

    async function walk(abs: string): Promise<void> {
      if (matches.length >= args.maxResults) { truncated = true; return; }
      const items = await fs.readdir(abs, { withFileTypes: true });
      for (const item of items) {
        if (matches.length >= args.maxResults) { truncated = true; return; }
        if (item.isDirectory() && ignoredDirectories.has(item.name)) continue;
        const itemAbs = path.join(abs, item.name);
        const relativeInput = path.relative(ctx.config.workspaceRoot, itemAbs);
        let safe;
        try { safe = await resolveWorkspacePath(relativeInput, { workspaceRoot: ctx.config.workspaceRoot, blockedPatterns: ctx.config.blockedPaths }); }
        catch { continue; }
        if (item.isDirectory()) { await walk(safe.absolutePath); continue; }
        const stat = await fs.stat(safe.absolutePath);
        if (stat.size > ctx.config.maxFileSizeBytes) continue;
        const buf = await fs.readFile(safe.absolutePath);
        if (buf.includes(0)) continue;
        const lines = buf.toString('utf8').split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
          if (matches.length >= args.maxResults) { truncated = true; return; }
          const line = lines[i] ?? '';
          const haystack = args.caseSensitive ? line : line.toLowerCase();
          if (haystack.includes(needle)) {
            const redacted = redactSecretLikeContent(line);
            if (redacted !== line) warnings.add('Potential secret-like content was redacted.');
            matches.push({ path: safe.relativePath, line: i + 1, text: redacted });
          }
        }
      }
    }

    await walk(root.absolutePath);
    return { pattern: args.pattern, matches, truncated, warnings: [...warnings] };
  }
};
