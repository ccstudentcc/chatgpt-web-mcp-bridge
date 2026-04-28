import { defineBackground } from 'wxt/utils/define-background';

import { startBackgroundBridge } from '../src/extension-shell/background.js';

export default defineBackground({
  main() {
    startBackgroundBridge();
  }
});
