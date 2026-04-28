import { truncateText, type TruncateResult } from '@cwmb/shared';
import type { CapturedShellOutput, CapturedShellStream } from './types.js';

export function shapeCapturedShellOutput(stdout: string, stderr: string, maxChars: number): CapturedShellOutput {
  const streamLimit = Math.max(1_000, Math.floor(maxChars / 3));
  const combined = combineShellStreams(stdout, stderr);

  return {
    stdout: toCapturedStream(truncateText(stdout, streamLimit)),
    stderr: toCapturedStream(truncateText(stderr, streamLimit)),
    combined: toCapturedStream(truncateText(combined, Math.max(streamLimit, maxChars)))
  };
}

export function collectShellOutputWarnings(output: CapturedShellOutput): string[] {
  const warnings: string[] = [];

  if (output.stdout.truncated) {
    warnings.push(`PowerShell stdout truncated from ${output.stdout.originalSizeChars} chars.`);
  }

  if (output.stderr.truncated) {
    warnings.push(`PowerShell stderr truncated from ${output.stderr.originalSizeChars} chars.`);
  }

  if (output.combined.truncated) {
    warnings.push(`PowerShell combined output truncated from ${output.combined.originalSizeChars} chars.`);
  }

  return warnings;
}

function combineShellStreams(stdout: string, stderr: string): string {
  if (!stdout) {
    return stderr;
  }

  if (!stderr) {
    return stdout;
  }

  return stdout.endsWith('\n') || stderr.startsWith('\n') ? `${stdout}${stderr}` : `${stdout}\n${stderr}`;
}

function toCapturedStream(result: TruncateResult): CapturedShellStream {
  return {
    text: result.text,
    truncated: result.truncated,
    originalSizeChars: result.originalSizeChars
  };
}
