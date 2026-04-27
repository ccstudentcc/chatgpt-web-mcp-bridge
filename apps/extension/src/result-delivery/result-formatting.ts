import type { BatchResultEnvelope, ExecutionErrorEnvelope, InlineToolResultEnvelope } from '@cwmb/protocol';

export function formatToolResult(tool: string, response: InlineToolResultEnvelope | ExecutionErrorEnvelope): string {
  const responseJson = JSON.stringify(response, null, 2);
  const lines = [
    `Bridge tool result for \`${tool}\`:`,
    'This result was executed outside the model after your previous `mcp` reply. Treat the fenced `tool_result` block below as the authoritative execution result.'
  ];
  const summary = buildTruncationSummary(tool, response);
  if (summary) {
    lines.push('', summary);
  }

  lines.push('', ...buildFencedBlock('tool_result', responseJson), '', 'Continue only after reading this bridge-provided tool result. Do not claim you already had the tool output before this message.');
  return lines.join('\n');
}

export function formatBatchToolResult(response: BatchResultEnvelope): string {
  const responseJson = JSON.stringify(response, null, 2);
  const warnings = response.warnings ?? [];
  const lines = [
    'Bridge batch tool results for one assistant reply:',
    'These results were executed outside the model after your previous `mcp` reply. Treat the fenced `tool_result_batch` block below as the authoritative execution result set.',
    `- total: ${response.summary.total}`,
    `- completed: ${response.summary.completed}`,
    `- failed: ${response.summary.failed}`,
    `- skipped: ${response.summary.skipped}`,
    `- stoppedOnFailure: ${response.summary.stoppedOnFailure}`
  ];

  if (warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const warning of warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push('', ...buildFencedBlock('tool_result_batch', responseJson), '', 'Continue only after reading these bridge-provided batch results. Do not claim you already had the tool output before this message.');
  return lines.join('\n');
}

function buildFencedBlock(language: string, content: string): [string, string, string] {
  const fence = chooseFence(content);
  return [`${fence}${language}`, content, fence];
}

function chooseFence(content: string): string {
  const longestBacktickRun = Math.max(0, ...Array.from(content.matchAll(/`+/g), (match) => match[0].length));
  return '`'.repeat(Math.max(3, longestBacktickRun + 1));
}

function buildTruncationSummary(tool: string, response: InlineToolResultEnvelope | ExecutionErrorEnvelope): string | null {
  if (response.type !== 'inline_tool_result') {
    return null;
  }

  const result = response.output;
  if (!result || typeof result !== 'object' || !('truncated' in result) || (result as { truncated?: unknown }).truncated !== true) {
    return null;
  }

  const lines = [`Tool result for \`${tool}\` was truncated before insertion.`];
  const returnedMatches = getNumberField(result, 'returnedMatches');
  const totalMatches = getNumberField(result, 'totalMatches');
  if (returnedMatches !== null && totalMatches !== null) {
    lines.push(`Returned matches: ${returnedMatches} / ${totalMatches}`);
  }

  const warnings = response.warnings ?? [];
  if (warnings.length > 0) {
    lines.push('Warnings:');
    for (const warning of warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return lines.join('\n');
}

function getNumberField(value: unknown, key: string): number | null {
  if (!value || typeof value !== 'object' || !(key in value)) {
    return null;
  }

  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'number' ? field : null;
}
