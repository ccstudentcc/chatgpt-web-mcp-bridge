import { chatgptSelectors, looksLikeChatGptSendButton, looksLikeChatGptStopButton } from './chatgpt-runtime-facts.js';
export { formatBatchToolResult, formatToolResult } from './result-delivery.js';

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

export async function sendCurrentChatInput({
  timeoutMs = 8_000,
  now = Date.now,
  waitForNextPoll = wait
}: {
  timeoutMs?: number;
  now?: () => number;
  waitForNextPoll?: (ms: number) => Promise<void>;
} = {}): Promise<boolean> {
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const button = findSendButton();
    if (button) {
      button.click();
      return true;
    }

    await waitForNextPoll(50);
  }

  return false;
}

export function isChatInputSubmitting(): boolean {
  return findSubmittingButton() !== null;
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
  return findComposerButton(looksLikeChatGptSendButton);
}

function findSubmittingButton(): HTMLButtonElement | null {
  return findComposerButton(looksLikeChatGptStopButton);
}

function findComposerButton(predicate: (button: HTMLButtonElement) => boolean): HTMLButtonElement | null {
  for (const selector of chatgptSelectors.sendButtons) {
    const button = document.querySelector(selector) as HTMLButtonElement | null;
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') {
      continue;
    }
    if (!isVisible(button)) {
      continue;
    }
    if (!predicate(button)) {
      continue;
    }

    return button;
  }

  return null;
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

function normalizeChatInputText(value: string): string {
  return value.replace(/\u00a0/g, ' ').trim();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
