import type { SupportedShell } from './types.js';

export const DEFAULT_SHELL: SupportedShell = 'pwsh';
export const DEFAULT_SHELL_TIMEOUT_MS = 120_000;
export const MIN_SHELL_TIMEOUT_MS = 1_000;
export const MAX_SHELL_TIMEOUT_MS = 300_000;
export const MAX_SHELL_COMMAND_CHARS = 2_000;

export function normalizeConfiguredShell(shell: string | undefined): SupportedShell {
  if (!shell) {
    return DEFAULT_SHELL;
  }

  if (shell === 'pwsh' || shell === 'powershell.exe') {
    return shell;
  }

  throw new Error(`Unsupported gateway shell: ${shell}`);
}
