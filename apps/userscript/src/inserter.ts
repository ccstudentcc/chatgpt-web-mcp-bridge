import type { ToolResultBatch } from './batch.js';
import { chatgptSelectors } from './selectors.js';

export function insertIntoChatInput(value: string): boolean {
  const editable = findVisibleEditable();
  if (editable) {
    editable.focus();
    if (tryExecCommandInsert(editable, value)) {
      dispatchInput(editable, value);
      return true;
    }

    replaceEditableContent(editable, value);
    dispatchInput(editable, value);
    return true;
  }

  const textarea = findVisibleTextarea();
  if (textarea) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
    return true;
  }

  GM_setClipboard(value);
  return false;
}

export async function sendCurrentChatInput(): Promise<boolean> {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const button = findSendButton();
    if (button) {
      button.click();
      return true;
    }

    await wait(50);
  }

  return false;
}

export function readCurrentChatInputText(): string {
  const editable = findVisibleEditable();
  if (editable) {
    return normalizeChatInputText(editable.innerText || editable.textContent || '');
  }

  const textarea = findVisibleTextarea();
  if (textarea) {
    return normalizeChatInputText(textarea.value);
  }

  return '';
}

function findSendButton(): HTMLButtonElement | null {
  for (const selector of chatgptSelectors.sendButtons) {
    const button = document.querySelector(selector) as HTMLButtonElement | null;
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') {
      continue;
    }
    if (!isVisible(button)) {
      continue;
    }
    if (!looksLikeSendButton(button)) {
      continue;
    }

    return button;
  }

  return null;
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

function findVisibleEditable(): HTMLElement | null {
  for (const selector of chatgptSelectors.editableInputs) {
    const match = Array.from(document.querySelectorAll(selector)).find((node): node is HTMLElement => node instanceof HTMLElement && isVisible(node));
    if (match) {
      return match;
    }
  }

  return null;
}

function findVisibleTextarea(): HTMLTextAreaElement | null {
  for (const selector of chatgptSelectors.textareas) {
    const match = Array.from(document.querySelectorAll(selector)).find((node): node is HTMLTextAreaElement => (
      node instanceof HTMLTextAreaElement
      && isVisible(node)
      && !node.disabled
    ));
    if (match) {
      return match;
    }
  }

  return null;
}

function tryExecCommandInsert(editable: HTMLElement, value: string): boolean {
  const execCommand = document.execCommand?.bind(document);
  if (!execCommand) {
    return false;
  }

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editable);
  selection?.removeAllRanges();
  selection?.addRange(range);

  execCommand('selectAll', false);
  return execCommand('insertText', false, value);
}

function replaceEditableContent(editable: HTMLElement, value: string): void {
  editable.replaceChildren();
  for (const line of value.split('\n')) {
    const paragraph = document.createElement('p');
    if (line.length === 0) {
      paragraph.appendChild(document.createElement('br'));
    } else {
      paragraph.textContent = line;
    }
    editable.appendChild(paragraph);
  }

  placeCaretAtEnd(editable);
}

function placeCaretAtEnd(editable: HTMLElement): void {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editable);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function dispatchInput(target: HTMLElement | HTMLTextAreaElement, value: string): void {
  target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
}

function isVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  if (el.getAttribute('hidden') !== null || el.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  return true;
}

function looksLikeSendButton(button: HTMLButtonElement): boolean {
  if (button.id === 'composer-submit-button' || button.dataset.testid === 'send-button') {
    return true;
  }

  const label = button.getAttribute('aria-label') ?? '';
  return /send|message|提示|发送/i.test(label) && !/voice|speech|语音/i.test(label);
}

function normalizeChatInputText(value: string): string {
  return value.replace(/\u00a0/g, ' ').trim();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
