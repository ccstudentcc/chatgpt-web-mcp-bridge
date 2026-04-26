import { spawn } from 'node:child_process';

export interface ShellInfo {
  preferred: 'pwsh';
  resolved: 'pwsh' | 'powershell.exe' | null;
  available: boolean;
  version?: string;
}

export async function detectShell(): Promise<ShellInfo> {
  const pwsh = await tryShell('pwsh');
  if (pwsh.available) return pwsh;

  const powershell = await tryShell('powershell.exe');
  if (powershell.available) return powershell;

  return { preferred: 'pwsh', resolved: null, available: false };
}

function tryShell(command: 'pwsh' | 'powershell.exe'): Promise<ShellInfo> {
  return new Promise((resolve) => {
    const child = spawn(command, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], {
      windowsHide: true
    });
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.on('error', () => resolve({ preferred: 'pwsh', resolved: null, available: false }));
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
