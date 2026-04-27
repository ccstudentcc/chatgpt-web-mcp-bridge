import {
  chatgptSelectors,
  findNearestChatGptUserTurn,
  isIgnorableChatGptAssistantPlaceholderText,
  listChatGptCodeBlockNodes,
  normalizeChatGptAssistantTurnCandidate,
  normalizeChatGptRuntimeText
} from './chatgpt-runtime-facts.js';

const DOCUMENT_POSITION_FOLLOWING = 4;
const bridgeResultFallbackSelector = [
  chatgptSelectors.userTurnContainer,
  'pre',
  'code'
].join(', ');

export function findAssistantMessages(): HTMLElement[] {
  const candidates = Array.from(document.querySelectorAll(chatgptSelectors.assistantMessage)) as HTMLElement[];
  if (candidates.length > 0) {
    return normalizeAssistantCandidates(candidates);
  }
  return fallbackFindCodeContainers();
}

export function findLatestOpenAssistantMessage(): HTMLElement | null {
  const candidates = findAssistantMessages();
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    if (!candidate || hasLaterBridgeResult(candidate) || isIgnorableAssistantPlaceholder(candidate)) {
      continue;
    }

    return candidate;
  }

  return null;
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
  let settleTimer: number | undefined;
  let hardDeadlineTimer: number | undefined;
  const flush = (): void => {
    if (typeof settleTimer === 'number') {
      window.clearTimeout(settleTimer);
      settleTimer = undefined;
    }
    if (typeof hardDeadlineTimer === 'number') {
      window.clearTimeout(hardDeadlineTimer);
      hardDeadlineTimer = undefined;
    }
    callback();
  };

  const observer = new MutationObserver(() => {
    if (typeof hardDeadlineTimer !== 'number') {
      hardDeadlineTimer = window.setTimeout(flush, 1_500);
    }
    if (typeof settleTimer === 'number') {
      window.clearTimeout(settleTimer);
    }
    settleTimer = window.setTimeout(flush, 400);
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
    const container = findNearestChatGptUserTurn(candidate)
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
  const text = normalizeChatGptRuntimeText(extractVisibleText(node));
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
  const codeBlocks = listChatGptCodeBlockNodes(document).filter((node): node is HTMLElement => node instanceof HTMLElement);
  const recentCandidates = codeBlocks.slice(-12);
  const seen = new Set<HTMLElement>();

  return recentCandidates
    .map((node) => normalizeFallbackCodeContainer(node))
    .filter((node): node is HTMLElement => Boolean(node))
    .filter((node) => {
      if (seen.has(node)) {
        return false;
      }
      seen.add(node);
      return true;
    })
    .filter((node) => looksLikeExplicitMcpRenderedBlock(extractVisibleText(node)));
}

function normalizeAssistantCandidates(candidates: HTMLElement[]): HTMLElement[] {
  const seen = new Set<HTMLElement>();

  return candidates
    .map((candidate) => normalizeChatGptAssistantTurnCandidate(candidate) ?? candidate)
    .filter((candidate) => {
      if (seen.has(candidate)) {
        return false;
      }
      seen.add(candidate);
      return true;
    });
}

function normalizeFallbackCodeContainer(node: HTMLElement): HTMLElement | null {
  const assistantTurn = normalizeChatGptAssistantTurnCandidate(node);
  if (assistantTurn) {
    return assistantTurn;
  }

  const pre = node.closest('pre') as HTMLElement | null;
  return pre ?? node;
}

function looksLikeExplicitMcpRenderedBlock(text: string): boolean {
  const trimmed = normalizeChatGptRuntimeText(text);
  if (!trimmed) {
    return false;
  }

  if (/^```mcp\b/i.test(trimmed)) {
    return true;
  }

  const firstBrace = trimmed.indexOf('{');
  if (firstBrace === -1) {
    return false;
  }

  const prelude = trimmed.slice(0, firstBrace).trim().toLowerCase();
  return /^mcp\b/.test(prelude) && trimmed.includes('"tool"') && trimmed.includes('"args"');
}

function isIgnorableAssistantPlaceholder(node: HTMLElement): boolean {
  return isIgnorableChatGptAssistantPlaceholderText(extractVisibleText(node));
}
