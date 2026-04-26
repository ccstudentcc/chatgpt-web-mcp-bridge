export const chatgptSelectors = {
  assistantMessage: '[data-message-author-role="assistant"]',
  codeBlock: 'pre code',
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
