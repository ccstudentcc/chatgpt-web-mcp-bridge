export const chatgptSelectors = {
  assistantMessage: '[data-message-author-role="assistant"]',
  userMessage: '[data-message-author-role="user"]',
  assistantTurnContainer: '[data-turn="assistant"], [data-message-author-role="assistant"]',
  userTurnContainer: '[data-turn="user"], [data-message-author-role="user"]',
  codeBlock: [
    'pre code',
    'pre',
    'code',
    '[data-testid*="code"]',
    '[class*="code-block"]',
    '[class*="CodeBlock"]',
    '[class*="whitespace-pre"]'
  ].join(', '),
  editableInputs: [
    '#prompt-textarea[contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"][aria-label]'
  ],
  textareas: [
    'textarea[name="prompt-textarea"]',
    'form textarea',
    'textarea'
  ],
  sendButtons: [
    '#composer-submit-button',
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label="Send message"]',
    'button[aria-label="发送提示"]',
    'button[aria-label="发送消息"]',
    'button[aria-label="发送"]',
    'form button[aria-label*="Send"]',
    'form button[aria-label*="发送"]'
  ]
} as const;

export const chatgptConversationPaths = [
  '/backend-api/conversation',
  '/backend-anon/conversation',
  '/backend-api/f/conversation'
] as const;

export const chatgptIgnorableStatusLinePatterns = [
  /^thought for .+$/i,
  /^reasoned for .+$/i,
  /^思考了.+$/u,
  /^已思考.+$/u,
  /^思考中$/u
] as const;

export function normalizeChatGptRuntimeText(text: string): string {
  return text.replace(/\u00a0/g, ' ').trim();
}

export function normalizeChatGptConversationPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export function isKnownChatGptConversationPath(pathname: string): boolean {
  const normalized = normalizeChatGptConversationPath(pathname);
  return chatgptConversationPaths.some((path) => normalized === path);
}

export function isIgnorableChatGptStatusLine(line: string): boolean {
  const normalized = normalizeChatGptRuntimeText(line);
  if (!normalized) {
    return false;
  }

  return chatgptIgnorableStatusLinePatterns.some((pattern) => pattern.test(normalized));
}

export function isIgnorableChatGptStatusText(text: string): boolean {
  const normalizedLines = text
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (normalizedLines.length === 0) {
    return false;
  }

  return normalizedLines.every((line) => isIgnorableChatGptStatusLine(line));
}

export function findNearestChatGptAssistantTurn(node: Element): HTMLElement | null {
  const explicitTurn = node.closest('[data-turn="assistant"]') as HTMLElement | null;
  if (explicitTurn) {
    return explicitTurn;
  }

  return node.closest(chatgptSelectors.assistantTurnContainer) as HTMLElement | null;
}

export function findNearestChatGptUserTurn(node: Element): HTMLElement | null {
  return node.closest(chatgptSelectors.userTurnContainer) as HTMLElement | null;
}

export function looksLikeChatGptSendButton(button: HTMLButtonElement): boolean {
  if (button.id === 'composer-submit-button' || button.dataset.testid === 'send-button') {
    return true;
  }

  const label = button.getAttribute('aria-label') ?? '';
  return /send|message|提示|发送/i.test(label) && !/voice|speech|语音/i.test(label);
}
