import { chatgptSelectors } from './selectors.js';

export function findLatestAssistantMessage(): HTMLElement | null {
  const candidates = Array.from(document.querySelectorAll(chatgptSelectors.assistantMessage)) as HTMLElement[];
  if (candidates.length > 0) return candidates[candidates.length - 1] ?? null;
  return fallbackFindLatestCodeContainer();
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

function fallbackFindLatestCodeContainer(): HTMLElement | null {
  const codeBlocks = Array.from(document.querySelectorAll(chatgptSelectors.codeBlock)) as HTMLElement[];
  const last = codeBlocks.slice(-5).reverse().find((node) => (node.innerText || '').includes('"tool"'));
  return last?.closest('pre') as HTMLElement | null;
}
