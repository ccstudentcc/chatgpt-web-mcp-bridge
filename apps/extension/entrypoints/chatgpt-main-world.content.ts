import { defineContentScript } from 'wxt/utils/define-content-script';

import { installPageHookBridge } from '../src/extension-shell/page-hook.js';

const CHATGPT_MATCHES = [
  'https://chatgpt.com/*',
  'https://chat.openai.com/*'
];

export default defineContentScript({
  matches: CHATGPT_MATCHES,
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    installPageHookBridge();
  }
});
