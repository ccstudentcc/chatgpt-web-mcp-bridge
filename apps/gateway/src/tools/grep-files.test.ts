import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { GatewayConfig } from '../config.js';
import { grepFilesTool } from '../builtin-tools/grep-files.js';

const createdRoots: string[] = [];

describe('grepFilesTool.argsSchema', () => {
  it('accepts a literal query or literal patterns, but not both', () => {
    expect(grepFilesTool.argsSchema.parse({ query: 'token' })).toMatchObject({ mode: 'literal', query: 'token' });
    expect(grepFilesTool.argsSchema.parse({ patterns: ['token', 'todo'], match: 'all' })).toMatchObject({
      mode: 'literal',
      patterns: ['token', 'todo'],
      match: 'all'
    });

    expect(() => grepFilesTool.argsSchema.parse({ query: 'token', patterns: ['todo'] })).toThrow(
      'Provide exactly one of query or patterns.'
    );
    expect(() => grepFilesTool.argsSchema.parse({ mode: 'regex', patterns: ['todo'] })).toThrow(
      'Regex mode only supports query, not patterns.'
    );
    expect(() => grepFilesTool.argsSchema.parse({ query: 'token', match: 'all' })).toThrow(
      'match is only supported with patterns.'
    );
  });
});

describe('grepFilesTool', () => {
  afterEach(async () => {
    while (createdRoots.length > 0) {
      const root = createdRoots.pop();
      if (root) {
        await fs.rm(root, { recursive: true, force: true });
      }
    }
  });

  it('redacts placeholder assignments for literal query mode and reports truncation counts', async () => {
    const root = await createWorkspace({
      'src/example.ts': [
        'const before = 1;',
        'const token = getToken();',
        'const middle = 2;',
        'const token = getBackupToken();',
        'const after = 3;'
      ].join('\n'),
      'notes/example.md': 'const token = getShouldNotMatch();'
    });

    const result = await grepFilesTool.run(
      { mode: 'literal', query: 'token', match: 'any', glob: '**/*.ts', maxResults: 1, caseSensitive: false, context: 1 },
      { config: makeConfig(root), logger: noOpLogger }
    );

    expect(result.modeUsed).toBe('literal');
    expect(['rg', 'node-fallback']).toContain(result.engine);
    expect(result.interpretedAs).toEqual({
      query: 'token',
      patterns: null,
      match: null
    });
    expect(result.totalMatches).toBe(2);
    expect(result.returnedMatches).toBe(1);
    expect(result.truncated).toBe(true);
    expect(result.matches[0]).toEqual({
      path: 'src/example.ts',
      line: 2,
      text: 'const token = [REDACTED]',
      before: ['const before = 1;'],
      after: ['const middle = 2;']
    });
    expect(result.warnings).toContain('Potential secret-like content was redacted.');
    expect(result.warnings).toContain('Result limit reached. Narrow query, patterns, glob, or context.');
  });

  it('supports literal multi-pattern all-match semantics at file scope', async () => {
    const root = await createWorkspace({
      'src/qualified.ts': [
        'const token = getToken();',
        'const mode = "strict";',
        'const todo = "ship it";'
      ].join('\n'),
      'src/partial.ts': 'const token = getToken();'
    });

    const result = await grepFilesTool.run(
      { mode: 'literal', patterns: ['token', 'todo'], match: 'all', glob: '**/*.ts', maxResults: 10, caseSensitive: false, context: 0 },
      { config: makeConfig(root), logger: noOpLogger }
    );

    expect(result.modeUsed).toBe('literal');
    expect(result.interpretedAs).toEqual({
      query: null,
      patterns: ['token', 'todo'],
      match: 'all'
    });
    expect(result.totalMatches).toBe(2);
    expect(result.matches.map((item) => `${item.path}:${item.line}`)).toEqual([
      'src/qualified.ts:1',
      'src/qualified.ts:3'
    ]);
  });

  it('supports regex query mode without relying on literal alternation parsing', async () => {
    const root = await createWorkspace({
      'docs/example.md': [
        'gateway exposes CORS checks',
        'bridge can call write_file manually',
        'run_task stays out of scope'
      ].join('\n')
    });

    const result = await grepFilesTool.run(
      { mode: 'regex', query: 'CORS|write_file', match: 'any', glob: '**/*.md', maxResults: 10, caseSensitive: true, context: 0 },
      { config: makeConfig(root), logger: noOpLogger }
    );

    expect(result.modeUsed).toBe('regex');
    expect(result.engine).toBe('node-fallback');
    expect(result.interpretedAs).toEqual({
      query: 'CORS|write_file',
      patterns: null,
      match: null
    });
    expect(result.totalMatches).toBe(2);
    expect(result.matches.map((item) => item.text)).toEqual([
      'gateway exposes CORS checks',
      'bridge can call write_file manually'
    ]);
  });

  it('blocks high-confidence secrets instead of returning redacted grep output', async () => {
    const root = await createWorkspace({
      'src/example.ts': 'const api_key = "sk-1234567890abcdef";'
    });

    await expect(
      grepFilesTool.run(
        { mode: 'literal', query: 'api_key', match: 'any', glob: '**/*.ts', maxResults: 10, caseSensitive: false, context: 0 },
        { config: makeConfig(root), logger: noOpLogger }
      )
    ).rejects.toMatchObject({
      code: 'SENSITIVE_CONTENT_BLOCKED'
    });
  });
});

async function createWorkspace(files: Record<string, string>): Promise<string> {
  const tmpRoot = path.join(process.cwd(), 'tmp');
  await fs.mkdir(tmpRoot, { recursive: true });
  const root = await fs.mkdtemp(path.join(tmpRoot, 'cwmb-grep-files-'));
  createdRoots.push(root);

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf8');
  }

  return root;
}

function makeConfig(workspaceRoot: string): GatewayConfig {
  return {
    host: '127.0.0.1',
    port: 8024,
    workspaceRoot,
    shell: 'pwsh',
    trustedLocalMode: true,
    allowPwsh: false,
    allowWrite: false,
    autoExecuteLowRisk: false,
    autoInsertResult: true,
    autoSendResult: false,
    maxToolRounds: 3,
    maxFileSizeBytes: 1_048_576,
    maxInsertedChars: 60_000,
    maxGatewayResultChars: 200_000,
    logRetentionDays: 14,
    blockedPaths: ['.env', '.env.*']
  };
}

const noOpLogger = {
  async write(): Promise<void> {}
};
