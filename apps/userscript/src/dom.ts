import { chatgptSelectors } from './selectors.js';

const DOCUMENT_POSITION_FOLLOWING = 4;
const bridgeResultFallbackSelector = [
  chatgptSelectors.userMessage,
  '[data-turn="user"]',
  'pre',
  'code'
].join(', ');

export function findAssistantMessages(): HTMLElement[] {
  const candidates = Array.from(document.querySelectorAll(chatgptSelectors.assistantMessage)) as HTMLElement[];
  if (candidates.length > 0) return candidates;
  return fallbackFindCodeContainers();
}

export function findLatestOpenAssistantMessage(): HTMLElement | null {
  const candidates = findAssistantMessages();
  const latest = candidates[candidates.length - 1] ?? null;
  if (!latest) {
    return null;
  }

  return hasLaterBridgeResult(latest) ? null : latest;
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

function hasLaterBridgeResult(message: HTMLElement): boolean {
  return findBridgeResultMessages().some((candidate) => isDocumentFollowing(message, candidate));
}

function findBridgeResultMessages(): HTMLElement[] {
  const userMessages = Array.from(document.querySelectorAll(chatgptSelectors.userMessage)) as HTMLElement[];
  const directMatches = userMessages.filter(isBridgeResultMessage);
  if (directMatches.length > 0) {
    return directMatches;
  }

  const seen = new Set<HTMLElement>();
  const fallbackMatches: HTMLElement[] = [];
  for (const candidate of Array.from(document.querySelectorAll(bridgeResultFallbackSelector)) as HTMLElement[]) {
    const container = (candidate.closest(chatgptSelectors.userMessage) as HTMLElement | null)
      ?? (candidate.closest('[data-turn="user"]') as HTMLElement | null)
      ?? candidate;
    if (seen.has(container) || !isBridgeResultMessage(container)) {
      continue;
    }

    seen.add(container);
    fallbackMatches.push(container);
  }

  return fallbackMatches;
}

function isBridgeResultMessage(node: HTMLElement): boolean {
  const text = extractVisibleText(node).replace(/\u00a0/g, ' ').trim();
  if (!text) {
    return false;
  }

  return text.includes('Bridge tool result for')
    || text.includes('Bridge batch tool results for one assistant reply:')
    || text.includes('Continue only after reading this bridge-provided tool result.')
    || text.includes('Continue only after reading these bridge-provided batch results.');
}

function isDocumentFollowing(reference: HTMLElement, candidate: HTMLElement): boolean {
  if (reference === candidate || typeof reference.compareDocumentPosition !== 'function') {
    return false;
  }

  return (reference.compareDocumentPosition(candidate) & DOCUMENT_POSITION_FOLLOWING) !== 0;
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
