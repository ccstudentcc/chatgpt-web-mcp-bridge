import { spawn } from 'node:child_process';
import type { ShellInfo, SpawnImpl, SupportedShell } from './types.js';

interface DetectShellOptions {
  spawnImpl?: SpawnImpl;
}

export async function detectShell(options: DetectShellOptions = {}): Promise<ShellInfo> {
  const spawnImpl = options.spawnImpl ?? spawn;
  const pwsh = await tryShell('pwsh', spawnImpl);
  if (pwsh.available) {
    return pwsh;
  }

  const powershell = await tryShell('powershell.exe', spawnImpl);
  if (powershell.available) {
    return powershell;
  }

  return { preferred: 'pwsh', resolved: null, available: false };
}

function tryShell(command: SupportedShell, spawnImpl: SpawnImpl): Promise<ShellInfo> {
  return new Promise((resolve) => {
    const child = spawnImpl(command, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], {
      windowsHide: true
    });
    let stdout = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.on('error', () => {
      resolve({ preferred: 'pwsh', resolved: null, available: false });
    });

    child.on('close', (code) => {
      resolve({
        preferred: 'pwsh',
        resolved: code === 0 ? command : null,
        available: code === 0,
        version: stdout.trim() || undefined
      });
    });
  });
}
