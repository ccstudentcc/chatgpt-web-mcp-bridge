import { installMainWorldRequestHook } from './page-hook-runtime.js';

let pageHookInstalled = false;

export function installPageHookBridge(): void {
  if (pageHookInstalled) {
    return;
  }

  pageHookInstalled = true;
  installMainWorldRequestHook(window);
}
