import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { matchesBlockedPath, resolveWorkspacePath } from './path-policy.js';

describe('tool-policy path policy', () => {
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

  it('matches sensitive blocked paths with dot-glob semantics', () => {
    expect(matchesBlockedPath('.env.local', ['.env', '.env.*'])).toBe(true);
    expect(matchesBlockedPath('docs/readme.md', ['.env', '.env.*'])).toBe(false);
  });
});
