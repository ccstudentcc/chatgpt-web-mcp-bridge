import type { BatchResultFailureItem, BatchResultItem } from '@cwmb/protocol';

export interface BatchFailurePresentation {
  lastError: string;
  logMessage: string;
}

export function describeBatchFailure(
  items: BatchResultItem[],
  stoppedOnFailure: boolean,
  failedCount?: number
): BatchFailurePresentation {
  const failed = items.find((item): item is BatchResultFailureItem => 'ok' in item && item.ok === false);
  if (stoppedOnFailure) {
    return {
      lastError: failed
        ? `Batch stopped after \`${failed.tool}\` failed: ${failed.error.message}`
        : 'Batch stopped after a tool call failed.',
      logMessage: `Batch stopped after a failure in ${failed?.tool ?? 'unknown'}.`
    };
  }

  return {
    lastError: failed
      ? `Batch completed with failures. First failed tool: \`${failed.tool}\` (${failed.error.message})`
      : 'Batch completed with one or more failed tool calls.',
    logMessage: `Batch completed with ${failedCount ?? items.filter((item) => 'ok' in item && item.ok === false).length} failed tool call(s).`
  };
}
