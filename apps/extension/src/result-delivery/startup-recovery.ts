export interface StartupRecoveryRestoreOptions {
  readCurrentComposerText: () => string;
  restorePersistedSession: (args: {
    currentComposerText: string;
    clearOnMismatch: boolean;
  }) => boolean;
  wait: (ms: number) => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export async function restorePersistedUndeliveredResultSessionOnStartup({
  readCurrentComposerText,
  restorePersistedSession,
  wait,
  now = Date.now,
  timeoutMs = 2_000,
  pollIntervalMs = 100
}: StartupRecoveryRestoreOptions): Promise<boolean> {
  const deadline = now() + timeoutMs;
  let latestComposerText = '';

  while (now() < deadline) {
    latestComposerText = readCurrentComposerText();
    if (restorePersistedSession({
      currentComposerText: latestComposerText,
      clearOnMismatch: false
    })) {
      return true;
    }

    await wait(pollIntervalMs);
  }

  return restorePersistedSession({
    currentComposerText: latestComposerText,
    clearOnMismatch: hasStartupRecoveryComposerText(latestComposerText)
  });
}

export function normalizeStartupRecoveryComposerText(value: string): string {
  return value.replace(/\u00a0/g, ' ').trim();
}

export function hasStartupRecoveryComposerText(value: string): boolean {
  return normalizeStartupRecoveryComposerText(value).length > 0;
}
