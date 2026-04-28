import { toErrorPayload } from '@cwmb/shared-utils';
import type { ToolCallFailure } from '@cwmb/tool-contracts';

export function failure(tool: string, error: unknown, durationMs: number, warnings: string[] = []): ToolCallFailure {
  return {
    ok: false,
    tool,
    error: toErrorPayload(error),
    warnings,
    durationMs
  };
}
