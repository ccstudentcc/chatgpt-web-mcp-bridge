import { defineContentScript } from 'wxt/utils/define-content-script';

import '../src/extension-shell/gm-shim.js';
import { startContentScriptBridge } from '../src/extension-shell/content-script.js';

const CHATGPT_MATCHES = [
  'https://chatgpt.com/*',
  'https://chat.openai.com/*'
];

export default defineContentScript({
  matches: CHATGPT_MATCHES,
  runAt: 'document_start',
  main() {
    startContentScriptBridge();
  }
});
