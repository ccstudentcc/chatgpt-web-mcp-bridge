import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { GatewayConfig } from '../config.js';
import { readFileTool } from './read-file.js';

const createdRoots: string[] = [];

describe('readFileTool', () => {
  afterEach(async () => {
    while (createdRoots.length > 0) {
      const root = createdRoots.pop();
      if (root) {
        await fs.rm(root, { recursive: true, force: true });
      }
    }
  });

  it('redacts assignment-style placeholders instead of blocking the whole file', async () => {
    const root = await createWorkspace({
      'src/example.ts': [
        'function getToken() {',
        "  return localStorage.getItem('userToken');",
        '}',
        'const token = getToken();'
      ].join('\n')
    });

    const result = await readFileTool.run(
      { path: 'src/example.ts', encoding: 'utf-8' },
      { config: makeConfig(root), logger: noOpLogger }
    );

    expect(result.content).toContain("return localStorage.getItem('userToken');");
    expect(result.content).toContain('const token = [REDACTED]');
  });

  it('still blocks high-confidence secrets', async () => {
    const root = await createWorkspace({
      'src/secrets.ts': 'const api_key = "sk-1234567890abcdef";'
    });

    await expect(
      readFileTool.run(
        { path: 'src/secrets.ts', encoding: 'utf-8' },
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
  const root = await fs.mkdtemp(path.join(tmpRoot, 'cwmb-read-file-'));
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
