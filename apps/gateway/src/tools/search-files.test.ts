import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GatewayConfig } from '../config.js';
import { searchFilesTool } from './search-files.js';

vi.mock('../utils/find-rg.js', () => ({
  hasRg: vi.fn(async () => false)
}));

const createdRoots: string[] = [];

describe('searchFilesTool', () => {
  afterEach(async () => {
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
