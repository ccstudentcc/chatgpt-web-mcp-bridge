import { spawn } from 'node:child_process';

export async function hasRg(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('rg', ['--version'], { windowsHide: true });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}
