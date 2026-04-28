import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { GatewayConfig } from '../config.js';
import { writeFileTool } from '../builtin-tools/write-file.js';

const createdRoots: string[] = [];

describe('writeFileTool', () => {
  afterEach(async () => {
    while (createdRoots.length > 0) {
      const root = createdRoots.pop();
      if (root) {
        await fs.rm(root, { recursive: true, force: true });
      }
    }
  });

  it('writes a UTF-8 file when allowWrite is enabled', async () => {
    const root = await createWorkspace();
    const result = await writeFileTool.run(
      {
        path: 'docs/example.md',
        content: '# Updated content',
        mode: 'replace'
      },
      { config: makeConfig(root, { allowWrite: true }), logger: noOpLogger }
    );

    expect(result).toEqual({
      path: 'docs/example.md',
      mode: 'replace',
      bytesWritten: Buffer.byteLength('# Updated content', 'utf8'),
      charsWritten: '# Updated content'.length
    });
    await expect(fs.readFile(path.join(root, 'docs/example.md'), 'utf8')).resolves.toBe('# Updated content');
  });

  it('rejects writes when allowWrite is disabled', async () => {
    const root = await createWorkspace();

    await expect(writeFileTool.run(
      {
        path: 'docs/example.md',
        content: '# Updated content',
        mode: 'replace'
      },
      { config: makeConfig(root), logger: noOpLogger }
    )).rejects.toMatchObject({ code: 'TOOL_DISABLED' });
  });

  it('refuses create mode when the file already exists', async () => {
    const root = await createWorkspace({
      'docs/example.md': 'Existing content'
    });

    await expect(writeFileTool.run(
      {
        path: 'docs/example.md',
        content: '# Updated content',
        mode: 'create'
      },
      { config: makeConfig(root, { allowWrite: true }), logger: noOpLogger }
    )).rejects.toMatchObject({ code: 'FILE_EXISTS' });
  });

  it('still applies blocked path policy when writing files', async () => {
    const root = await createWorkspace();

    await expect(writeFileTool.run(
      {
        path: '.env',
        content: 'SECRET=1',
        mode: 'replace'
      },
      { config: makeConfig(root, { allowWrite: true }), logger: noOpLogger }
    )).rejects.toMatchObject({ code: 'BLOCKED_PATH' });
  });
});

async function createWorkspace(files: Record<string, string> = {}): Promise<string> {
  const tmpRoot = path.join(process.cwd(), 'tmp');
  await fs.mkdir(tmpRoot, { recursive: true });
  const root = await fs.mkdtemp(path.join(tmpRoot, 'cwmb-write-file-'));
  createdRoots.push(root);

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf8');
  }

  return root;
}

function makeConfig(workspaceRoot: string, overrides: Partial<GatewayConfig> = {}): GatewayConfig {
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
    blockedPaths: ['.env', '.env.*'],
    ...overrides
  };
}

const noOpLogger = {
  async write(): Promise<void> {}
};
