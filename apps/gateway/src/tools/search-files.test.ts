import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { minimatch } from 'minimatch';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GatewayConfig } from '../config.js';

const mockHasRg = vi.hoisted(() => vi.fn());
const mockSpawn = vi.hoisted(() => vi.fn());

vi.mock('../builtin-tools/rg-runtime.js', async () => {
  const actual = await vi.importActual<typeof import('../builtin-tools/rg-runtime.js')>('../builtin-tools/rg-runtime.js');
  return {
    ...actual,
    hasRg: mockHasRg
  };
});

vi.mock('node:child_process', () => ({
  spawn: mockSpawn
}));

import { searchFilesTool } from '../builtin-tools/search-files.js';

const createdRoots: string[] = [];

describe('searchFilesTool', () => {
  afterEach(async () => {
    mockHasRg.mockReset();
    mockHasRg.mockResolvedValue(false);
    mockSpawn.mockReset();
    while (createdRoots.length > 0) {
      const root = createdRoots.pop();
      if (root) {
        await fs.rm(root, { recursive: true, force: true });
      }
    }
  });

  it('filters by glob and reports truncation metadata', async () => {
    const root = await createWorkspace({
      'README.md': '# root',
      'docs/README.md': '# docs',
      'src/readme.ts': 'export const readme = true;'
    });

    const result = await searchFilesTool.run(
      { query: 'read', glob: '**/*.md', maxResults: 1 },
      { config: makeConfig(root), logger: noOpLogger }
    );

    expect(result.matches).toEqual(['README.md']);
    expect(result.totalMatches).toBe(2);
    expect(result.returnedMatches).toBe(1);
    expect(result.truncated).toBe(true);
  });

  it('does not return blocked paths', async () => {
    const root = await createWorkspace({
      '.env': 'SECRET=1',
      'docs/env-guide.md': 'env notes'
    });

    const result = await searchFilesTool.run(
      { query: '.env', maxResults: 10 },
      { config: makeConfig(root), logger: noOpLogger }
    );

    expect(result.matches).toEqual([]);
    expect(result.totalMatches).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it('uses rg prefilter when available', async () => {
    mockHasRg.mockResolvedValue(true);
    installMockRgSuccess();

    const root = await createWorkspace({
      'README.md': '# root',
      'docs/README.md': '# docs',
      'src/readme.ts': 'export const readme = true;',
      'src/index.ts': 'export const index = true;'
    });

    const result = await searchFilesTool.run(
      { query: 'read', glob: '**/*.md', maxResults: 10 },
      { config: makeConfig(root), logger: noOpLogger }
    );

    expect(result.matches).toEqual(['README.md', 'docs/README.md']);
    expect(result.totalMatches).toBe(2);
    expect(result.returnedMatches).toBe(2);
    expect(result.truncated).toBe(false);
    expect(mockSpawn).toHaveBeenCalledTimes(2);
    expect(mockSpawn).toHaveBeenNthCalledWith(
      1,
      'rg',
      ['--files', '--hidden', '-g', '**/*.md'],
      expect.objectContaining({ cwd: root, windowsHide: true })
    );
    expect(mockSpawn).toHaveBeenNthCalledWith(
      2,
      'rg',
      ['--fixed-strings', '--ignore-case', 'read'],
      expect.objectContaining({ cwd: root, windowsHide: true })
    );
  });

  it('falls back to node walk when rg search fails', async () => {
    mockHasRg.mockResolvedValue(true);
    installMockRgFailure('rg failed');

    const root = await createWorkspace({
      'README.md': '# root',
      'docs/README.md': '# docs',
      'src/readme.ts': 'export const readme = true;'
    });

    const result = await searchFilesTool.run(
      { query: 'read', glob: '**/*.md', maxResults: 10 },
      { config: makeConfig(root), logger: noOpLogger }
    );

    expect(result.matches).toEqual(['README.md', 'docs/README.md']);
    expect(result.totalMatches).toBe(2);
    expect(result.returnedMatches).toBe(2);
    expect(result.truncated).toBe(false);
  });

  it('keeps rg and fallback results aligned', async () => {
    const root = await createWorkspace({
      'README.md': '# root',
      'docs/README.md': '# docs',
      'src/readme.ts': 'export const readme = true;',
      'src/reader.ts': 'export const reader = true;',
      '.env': 'SECRET=1'
    });

    mockHasRg.mockResolvedValue(true);
    installMockRgSuccess();
    const rgResult = await searchFilesTool.run(
      { query: 'read', maxResults: 10 },
      { config: makeConfig(root), logger: noOpLogger }
    );

    mockHasRg.mockResolvedValue(false);
    mockSpawn.mockReset();
    const fallbackResult = await searchFilesTool.run(
      { query: 'read', maxResults: 10 },
      { config: makeConfig(root), logger: noOpLogger }
    );

    expect(rgResult).toEqual(fallbackResult);
  });
});

async function createWorkspace(files: Record<string, string>): Promise<string> {
  const tmpRoot = path.join(process.cwd(), 'tmp');
  await fs.mkdir(tmpRoot, { recursive: true });
  const root = await fs.mkdtemp(path.join(tmpRoot, 'cwmb-search-files-'));
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

function installMockRgSuccess(): void {
  mockSpawn.mockImplementation((command: string, args: string[], options?: { cwd?: string }) => {
    expect(command).toBe('rg');
    const cwd = options?.cwd;
    if (!cwd) {
      throw new Error('cwd is required for rg search tests');
    }

    if (args[0] === '--files') {
      return createMockListChild(cwd, args);
    }

    if (args[0] === '--fixed-strings') {
      return createMockFilterChild(args);
    }

    throw new Error(`Unexpected rg invocation: ${args.join(' ')}`);
  });
}

function installMockRgFailure(message: string): void {
  mockSpawn.mockImplementationOnce((_command: string, _args: string[], _options?: { cwd?: string }) => {
    const child = createMockChild();
    queueMicrotask(() => {
      child.stderr.write(message);
      child.stderr.end();
      child.stdout.end();
      child.emit('close', 2);
    });
    return child;
  });
  mockSpawn.mockImplementation((_command: string, args: string[]) => {
    if (args[0] === '--fixed-strings') {
      return createMockFilterChild(args);
    }

    throw new Error(`Unexpected rg invocation: ${args.join(' ')}`);
  });
}

function createMockListChild(cwd: string, args: string[]): MockChild {
  const child = createMockChild();
  const glob = extractGlob(args);
  queueMicrotask(async () => {
    try {
      const lines = await listWorkspacePaths(cwd, glob);
      if (lines.length > 0) {
        child.stdout.write(lines.join('\n'));
      }
      child.stdout.end();
      child.stderr.end();
      child.emit('close', 0);
    } catch (error) {
      child.stderr.write(error instanceof Error ? error.message : String(error));
      child.stderr.end();
      child.stdout.end();
      child.emit('close', 2);
    }
  });
  return child;
}

function createMockFilterChild(args: string[]): MockChild {
  const child = createMockChild();
  const query = args.at(-1)?.toLowerCase() ?? '';
  let input = '';

  child.stdin.on('data', (chunk) => {
    input += String(chunk);
  });
  child.stdin.on('end', () => {
    const matches = input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => line.toLowerCase().includes(query));

    if (matches.length > 0) {
      child.stdout.write(matches.join('\n'));
    }
    child.stdout.end();
    child.stderr.end();
    child.emit('close', matches.length > 0 ? 0 : 1);
  });

  return child;
}

function createMockChild(): MockChild {
  const child = new EventEmitter() as MockChild;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  return child;
}

function extractGlob(args: string[]): string | undefined {
  const globIndex = args.indexOf('-g');
  if (globIndex === -1) {
    return undefined;
  }

  return args[globIndex + 1];
}

async function listWorkspacePaths(root: string, glob?: string): Promise<string[]> {
  const results: string[] = [];
  await walk(root);
  return results;

  async function walk(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = path.relative(root, absolutePath).replaceAll(path.sep, '/');
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!glob || minimatch(relativePath, glob, { nocase: true, dot: true })) {
        results.push(relativePath);
      }
    }
  }
}

interface MockChild extends EventEmitter {
  stdin: PassThrough;
  stdout: PassThrough;
  stderr: PassThrough;
}
