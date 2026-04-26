import { toErrorPayload } from '@cwmb/shared';
import type { ToolCallFailure } from '@cwmb/protocol';

export function failure(tool: string, error: unknown, durationMs: number, warnings: string[] = []): ToolCallFailure {
  return {
    ok: false,
    tool,
    error: toErrorPayload(error),
    warnings,
    durationMs
  };
}
