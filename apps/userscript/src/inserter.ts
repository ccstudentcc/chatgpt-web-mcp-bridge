import { chatgptSelectors, looksLikeChatGptSendButton, looksLikeChatGptStopButton } from './chatgpt-runtime-facts.js';
export { formatBatchToolResult, formatToolResult } from './result-delivery.js';

export function insertIntoChatInput(value: string): boolean {
  const editable = findVisibleEditable();
  if (editable) {
    editable.focus();
    if (tryExecCommandInsert(editable, value) && matchesEditableText(editable, value)) {
      dispatchInput(editable, value);
      dispatchChange(editable);
      return true;
    }

    replaceEditableContent(editable, value);
    dispatchInput(editable, value);
    dispatchChange(editable);
    return true;
  }

  const textarea = findVisibleTextarea();
  if (textarea) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
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
      pressComposerButton(button);
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
    return normalizeChatInputText(readEditableText(editable));
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
    const matches = Array.from(document.querySelectorAll(selector)).filter((node): node is HTMLButtonElement => node instanceof HTMLButtonElement);
    for (const button of matches) {
      if (button.disabled || button.getAttribute('aria-disabled') === 'true') {
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

  editable.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: value }));
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

function dispatchChange(target: HTMLElement | HTMLTextAreaElement): void {
  target.dispatchEvent(new Event('change', { bubbles: true }));
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

function matchesEditableText(editable: HTMLElement, expected: string): boolean {
  return normalizeEditableRoundTripText(readEditableText(editable))
    === normalizeEditableRoundTripText(expected);
}

function normalizeEditableRoundTripText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trimEnd();
}

function readEditableText(editable: HTMLElement): string {
  if (!editable.childNodes.length) {
    return editable.textContent || editable.innerText || '';
  }

  const serialized = Array.from(editable.childNodes)
    .map((node) => serializeEditableNode(node))
    .join('');

  return serialized.replace(/\n+$/u, '');
}

function serializeEditableNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }

  if (!(node instanceof HTMLElement)) {
    return '';
  }

  if (node.tagName === 'BR') {
    return '\n';
  }

  const text = Array.from(node.childNodes)
    .map((child) => serializeEditableNode(child))
    .join('');

  if (node.tagName === 'P' || node.tagName === 'DIV') {
    return `${text}\n`;
  }

  return text;
}

function pressComposerButton(button: HTMLButtonElement): void {
  button.focus();
  dispatchPointerLikeEvent(button, 'pointerdown');
  dispatchMouseEvent(button, 'mousedown');
  dispatchPointerLikeEvent(button, 'pointerup');
  dispatchMouseEvent(button, 'mouseup');
  button.click();
}

function dispatchPointerLikeEvent(target: HTMLButtonElement, type: 'pointerdown' | 'pointerup'): void {
  const PointerEventCtor = window.PointerEvent;
  if (typeof PointerEventCtor === 'function') {
    target.dispatchEvent(new PointerEventCtor(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0 }));
    return;
  }

  dispatchMouseEvent(target, type === 'pointerdown' ? 'mousedown' : 'mouseup');
}

function dispatchMouseEvent(target: HTMLButtonElement, type: 'mousedown' | 'mouseup'): void {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
