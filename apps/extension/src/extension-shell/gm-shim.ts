import { EXTENSION_MESSAGE_TYPES, type GatewayProxyRequestMessage } from './messages.js';

const STORAGE_PREFIX = 'cwmb_ext:';

if (!globalThis.GM_getValue) {
  globalThis.GM_getValue = (key: string, defaultValue = ''): string => {
    try {
      return window.localStorage.getItem(`${STORAGE_PREFIX}${key}`) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  };
}

if (!globalThis.GM_setValue) {
  globalThis.GM_setValue = (key: string, value: string): void => {
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
    } catch {
      // Ignore storage write failures and keep runtime alive.
    }
  };
}

if (!globalThis.GM_setClipboard) {
  globalThis.GM_setClipboard = (text: string): void => {
    void copyToClipboard(text);
  };
}

if (!globalThis.GM_xmlhttpRequest) {
  globalThis.GM_xmlhttpRequest = (options) => {
    const message: GatewayProxyRequestMessage = {
      type: EXTENSION_MESSAGE_TYPES.gatewayRequest,
      request: {
        method: options.method,
        url: options.url,
        data: options.data,
        headers: options.headers,
        timeout: options.timeout
      }
    };

    chrome.runtime.sendMessage(message, (response: { ok?: boolean; status?: number; responseText?: string; error?: string; timedOut?: boolean } | undefined) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        options.onerror?.(new Error(runtimeError.message || 'Extension runtime messaging failed'));
        return;
      }

      if (!response) {
        options.onerror?.(new Error('Gateway proxy returned no response'));
        return;
      }

      if (response.ok) {
        options.onload?.({
          status: response.status ?? 0,
          responseText: response.responseText ?? ''
        });
        return;
      }

      if (response.timedOut) {
        options.ontimeout?.();
        return;
      }

      options.onerror?.(new Error(response.error || 'Gateway proxy failed'));
    });
  };
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fall through to the DOM-copy fallback below.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  document.documentElement.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand?.('copy');
  textarea.remove();
}
