import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveWorkspacePath } from './path-policy.js';

describe('resolveWorkspacePath', () => {
  it('rejects workspace escape', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cwmb-'));
    await expect(resolveWorkspacePath('../secret.txt', { workspaceRoot: root, blockedPatterns: [] })).rejects.toThrow();
  });

  it('accepts normal relative paths', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cwmb-'));
    await fs.writeFile(path.join(root, 'README.md'), 'ok');
    const result = await resolveWorkspacePath('README.md', { workspaceRoot: root, blockedPatterns: [] });
    expect(result.relativePath).toBe('README.md');
  });

  it('rejects blocked paths', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cwmb-'));
    await fs.writeFile(path.join(root, '.env'), 'SECRET=1');
    await expect(resolveWorkspacePath('.env', { workspaceRoot: root, blockedPatterns: ['.env'] })).rejects.toThrow();
  });
});
