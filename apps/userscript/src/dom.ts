import { chatgptSelectors } from './selectors.js';

export function findAssistantMessages(): HTMLElement[] {
  const candidates = Array.from(document.querySelectorAll(chatgptSelectors.assistantMessage)) as HTMLElement[];
  if (candidates.length > 0) return candidates;
  return fallbackFindCodeContainers();
}

export function findLatestAssistantMessage(): HTMLElement | null {
  const candidates = findAssistantMessages();
  return candidates.length > 0 ? candidates[candidates.length - 1] ?? null : null;
}

export function findLatestUserMessage(): HTMLElement | null {
  const candidates = Array.from(document.querySelectorAll(chatgptSelectors.userMessage)) as HTMLElement[];
  return candidates.length > 0 ? candidates[candidates.length - 1] ?? null : null;
}

export function extractVisibleText(el: HTMLElement): string {
  return el.innerText || el.textContent || '';
}

export function onChatMutation(callback: () => void): void {
  let timer: number | undefined;
  const observer = new MutationObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(callback, 900);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function fallbackFindCodeContainers(): HTMLElement[] {
  const codeBlocks = Array.from(document.querySelectorAll(chatgptSelectors.codeBlock)) as HTMLElement[];
  return codeBlocks
    .slice(-8)
    .map((node) => node.closest('pre') as HTMLElement | null)
    .filter((node): node is HTMLElement => Boolean(node) && (node!.innerText || '').includes('"tool"'));
}
