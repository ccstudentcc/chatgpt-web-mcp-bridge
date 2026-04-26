import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { GatewayConfig } from '../config.js';
import { grepFilesTool } from './grep-files.js';

const createdRoots: string[] = [];

describe('grepFilesTool', () => {
  afterEach(async () => {
    while (createdRoots.length > 0) {
      const root = createdRoots.pop();
      if (root) {
        await fs.rm(root, { recursive: true, force: true });
      }
    }
  });

  it('redacts placeholder assignments and reports truncation counts', async () => {
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
      { pattern: 'token', glob: '**/*.ts', maxResults: 1, caseSensitive: false, context: 1 },
      { config: makeConfig(root), logger: noOpLogger }
    );

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
    expect(result.warnings).toContain('Result limit reached. Narrow pattern, glob, or context.');
  });

  it('blocks high-confidence secrets instead of returning redacted grep output', async () => {
    const root = await createWorkspace({
      'src/example.ts': 'const api_key = "sk-1234567890abcdef";'
    });

    await expect(
      grepFilesTool.run(
        { pattern: 'api_key', glob: '**/*.ts', maxResults: 10, caseSensitive: false, context: 0 },
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
