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
    .map((node) => {
      const pre = node.closest('pre') as HTMLElement | null;
      const assistantTurn = node.closest('[data-turn="assistant"], [data-message-author-role="assistant"]') as HTMLElement | null;
      return pre ?? assistantTurn;
    })
    .filter((node): node is HTMLElement => Boolean(node))
    .filter((node) => {
      const text = node.innerText || node.textContent || '';
      return /(^|\n)\s*mcp\s*\n[\s\S]*"tool"[\s\S]*"args"/i.test(text);
    });
}
