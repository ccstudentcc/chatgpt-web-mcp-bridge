import type { ToolResultBatch } from './batch.js';

export function insertIntoChatInput(value: string): boolean {
  const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
  if (textarea) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
    return true;
  }

  const editable = document.querySelector('[contenteditable="true"]') as HTMLElement | null;
  if (editable) {
    editable.focus();
    editable.textContent = value;
    editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    return true;
  }

  GM_setClipboard(value);
  return false;
}

export function sendCurrentChatInput(): boolean {
  const selectors = [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label="Send message"]',
    'button[aria-label="发送消息"]',
    'button[aria-label="发送"]',
    'form button[aria-label*="Send"]',
    'form button[aria-label*="发送"]'
  ];

  for (const selector of selectors) {
    const button = document.querySelector(selector) as HTMLButtonElement | null;
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') {
      continue;
    }

    button.click();
    return true;
  }

  return false;
}

export function formatToolResult(tool: string, response: unknown): string {
  const lines = [`Tool result for \`${tool}\`:`];
  const summary = buildTruncationSummary(tool, response);
  if (summary) {
    lines.push('', summary);
  }

  lines.push('', '```tool_result', JSON.stringify(response, null, 2), '```', '', 'Please continue based on this tool result.');
  return lines.join('\n');
}

export function formatBatchToolResult(response: ToolResultBatch): string {
  const lines = [
    'Batch tool results for one assistant reply:',
    `- total: ${response.summary.total}`,
    `- completed: ${response.summary.completed}`,
    `- failed: ${response.summary.failed}`,
    `- skipped: ${response.summary.skipped}`,
    `- stoppedOnFailure: ${response.summary.stoppedOnFailure}`
  ];

  if (response.warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const warning of response.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push('', '```tool_result_batch', JSON.stringify(response, null, 2), '```', '', 'Please continue based on the batch tool results above.');
  return lines.join('\n');
}

function buildTruncationSummary(tool: string, response: unknown): string | null {
  if (!response || typeof response !== 'object' || !('result' in response)) {
    return null;
  }

  const result = (response as { result?: unknown }).result;
  if (!result || typeof result !== 'object' || !('truncated' in result) || (result as { truncated?: unknown }).truncated !== true) {
    return null;
  }

  const lines = [`Tool result for \`${tool}\` was truncated before insertion.`];
  const returnedMatches = getNumberField(result, 'returnedMatches');
  const totalMatches = getNumberField(result, 'totalMatches');
  if (returnedMatches !== null && totalMatches !== null) {
    lines.push(`Returned matches: ${returnedMatches} / ${totalMatches}`);
  }

  const warnings = getWarnings(response);
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

function getWarnings(response: unknown): string[] {
  if (!response || typeof response !== 'object' || !('warnings' in response)) {
    return [];
  }

  const warnings = (response as { warnings?: unknown }).warnings;
  return Array.isArray(warnings) ? warnings.filter((item): item is string => typeof item === 'string') : [];
}
