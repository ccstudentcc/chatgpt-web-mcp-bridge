import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { detectShell } from './detect-shell.js';
import type { SpawnImpl } from './types.js';

describe('shell-runtime detectShell', () => {
  it('returns pwsh when the preferred shell is available', async () => {
    const spawnImpl = vi.fn((command: string) => {
      const child = createMockChild();
      queueMicrotask(() => {
        child.stdout.write('7.5.0');
        child.stdout.end();
        child.stderr.end();
        child.emit('close', command === 'pwsh' ? 0 : 1);
      });
      return child as never;
    }) as unknown as SpawnImpl;

    await expect(detectShell({ spawnImpl })).resolves.toEqual({
      preferred: 'pwsh',
      resolved: 'pwsh',
      available: true,
      version: '7.5.0'
    });
    expect(spawnImpl).toHaveBeenCalledTimes(1);
  });

  it('falls back to powershell.exe when pwsh is unavailable', async () => {
    const spawnImpl = vi.fn((command: string) => {
      const child = createMockChild();
      queueMicrotask(() => {
        if (command === 'pwsh') {
          child.emit('error', new Error('missing'));
          return;
        }

        child.stdout.write('5.1.22621.2506');
        child.stdout.end();
        child.stderr.end();
        child.emit('close', 0);
      });
      return child as never;
    }) as unknown as SpawnImpl;

    await expect(detectShell({ spawnImpl })).resolves.toEqual({
      preferred: 'pwsh',
      resolved: 'powershell.exe',
      available: true,
      version: '5.1.22621.2506'
    });
    expect(spawnImpl).toHaveBeenCalledTimes(2);
  });

  it('reports unavailable when no supported shell can be started', async () => {
    const spawnImpl = vi.fn(() => {
      const child = createMockChild();
      queueMicrotask(() => {
        child.emit('error', new Error('missing'));
      });
      return child as never;
    }) as unknown as SpawnImpl;

    await expect(detectShell({ spawnImpl })).resolves.toEqual({
      preferred: 'pwsh',
      resolved: null,
      available: false
    });
  });
});

interface MockChild extends EventEmitter {
  stdout: PassThrough;
  stderr: PassThrough;
}

function createMockChild(): MockChild {
  const child = new EventEmitter() as MockChild;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  return child;
}
