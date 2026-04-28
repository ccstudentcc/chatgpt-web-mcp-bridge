import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'node:child_process';

export const supportedShells = ['pwsh', 'powershell.exe'] as const;

export type SupportedShell = (typeof supportedShells)[number];
export type SpawnImpl = (
  command: string,
  args: ReadonlyArray<string>,
  options?: SpawnOptionsWithoutStdio
) => ChildProcessWithoutNullStreams;

export interface ShellInfo {
  preferred: 'pwsh';
  resolved: SupportedShell | null;
  available: boolean;
  version?: string;
}

export interface CapturedShellStream {
  text: string;
  truncated: boolean;
  originalSizeChars: number;
}

export interface CapturedShellOutput {
  stdout: CapturedShellStream;
  stderr: CapturedShellStream;
  combined: CapturedShellStream;
}

export interface ShellCommandOutcome {
  shell: SupportedShell;
  command: string;
  cwd: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  durationMs: number;
  output: CapturedShellOutput;
  warnings: string[];
}
