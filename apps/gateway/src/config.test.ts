import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const tempRoots: string[] = [];

describe('loadConfig', () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it('creates a config file and infers workspaceRoot from cwd on first launch', async () => {
    const appHome = await makeTempDir('cwmb-config-');
    const workspaceRoot = path.join(appHome, 'workspace');
    await fs.mkdir(workspaceRoot, { recursive: true });

    const config = await loadConfig({ appHomeOverride: appHome, cwdOverride: workspaceRoot });
    const written = JSON.parse(await fs.readFile(path.join(appHome, 'config.json'), 'utf8')) as { workspaceRoot?: string };

    expect(config.workspaceRoot).toBe(path.resolve(workspaceRoot));
    expect(written.workspaceRoot).toBe(path.resolve(workspaceRoot));
  });

  it('backfills workspaceRoot when an existing config leaves it empty', async () => {
    const appHome = await makeTempDir('cwmb-config-');
    const workspaceRoot = path.join(appHome, 'workspace');
    await fs.mkdir(workspaceRoot, { recursive: true });
    await fs.writeFile(
      path.join(appHome, 'config.json'),
      `${JSON.stringify({ host: '127.0.0.1', port: 8024, workspaceRoot: '' }, null, 2)}\n`,
      'utf8'
    );

    const config = await loadConfig({ appHomeOverride: appHome, cwdOverride: workspaceRoot });
    expect(config.workspaceRoot).toBe(path.resolve(workspaceRoot));
  });

  it('keeps an explicit workspaceRoot unchanged', async () => {
    const appHome = await makeTempDir('cwmb-config-');
    const workspaceRoot = path.join(appHome, 'explicit-workspace');
    const cwdRoot = path.join(appHome, 'cwd-workspace');
    await fs.mkdir(workspaceRoot, { recursive: true });
    await fs.mkdir(cwdRoot, { recursive: true });
    await fs.writeFile(
      path.join(appHome, 'config.json'),
      `${JSON.stringify({ host: '127.0.0.1', port: 8024, workspaceRoot }, null, 2)}\n`,
      'utf8'
    );

    const config = await loadConfig({ appHomeOverride: appHome, cwdOverride: cwdRoot });
    expect(config.workspaceRoot).toBe(workspaceRoot);
  });

  it('keeps a supported shell selection from config', async () => {
    const appHome = await makeTempDir('cwmb-config-');
    const workspaceRoot = path.join(appHome, 'workspace');
    await fs.mkdir(workspaceRoot, { recursive: true });
    await fs.writeFile(
      path.join(appHome, 'config.json'),
      `${JSON.stringify({ host: '127.0.0.1', port: 8024, workspaceRoot, shell: 'powershell.exe' }, null, 2)}\n`,
      'utf8'
    );

    const config = await loadConfig({ appHomeOverride: appHome, cwdOverride: workspaceRoot });
    expect(config.shell).toBe('powershell.exe');
  });

  it('rejects unsupported shell selections from config', async () => {
    const appHome = await makeTempDir('cwmb-config-');
    const workspaceRoot = path.join(appHome, 'workspace');
    await fs.mkdir(workspaceRoot, { recursive: true });
    await fs.writeFile(
      path.join(appHome, 'config.json'),
      `${JSON.stringify({ host: '127.0.0.1', port: 8024, workspaceRoot, shell: 'bash' }, null, 2)}\n`,
      'utf8'
    );

    await expect(loadConfig({ appHomeOverride: appHome, cwdOverride: workspaceRoot })).rejects.toThrow(
      'Unsupported gateway shell: bash'
    );
  });
});

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}
