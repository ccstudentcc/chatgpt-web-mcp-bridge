import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { GatewayConfig } from '../config.js';
import { listDirectoryTool } from './list-directory.js';

const createdRoots: string[] = [];

describe('listDirectoryTool', () => {
  afterEach(async () => {
    while (createdRoots.length > 0) {
      const root = createdRoots.pop();
      if (root) {
        await fs.rm(root, { recursive: true, force: true });
      }
    }
  });

  it('lists safe workspace entries and reports truncation at the configured limit', async () => {
    const root = await createWorkspace({
      'docs/guide.md': '# guide',
      'docs/tutorial.md': '# tutorial',
      'src/index.ts': 'export const ok = true;',
      'node_modules/skip.js': 'ignored'
    });

    const result = await listDirectoryTool.run(
      { path: '.', maxDepth: 2, maxEntries: 3 },
      { config: makeConfig(root), logger: noOpLogger }
    );
    const sortedEntries = [...result.entries].sort((left, right) => left.path.localeCompare(right.path));

    expect(result.root).toBe('.');
    expect(sortedEntries).toEqual([
      { path: 'docs', type: 'directory' },
      { path: 'docs/guide.md', type: 'file', sizeBytes: '# guide'.length },
      { path: 'docs/tutorial.md', type: 'file', sizeBytes: '# tutorial'.length }
    ]);
    expect(result.truncated).toBe(true);
    expect(result.entries.some((entry) => entry.path.startsWith('node_modules'))).toBe(false);
  });
});

async function createWorkspace(files: Record<string, string>): Promise<string> {
  const tmpRoot = path.join(process.cwd(), 'tmp');
  await fs.mkdir(tmpRoot, { recursive: true });
  const root = await fs.mkdtemp(path.join(tmpRoot, 'cwmb-list-directory-'));
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
