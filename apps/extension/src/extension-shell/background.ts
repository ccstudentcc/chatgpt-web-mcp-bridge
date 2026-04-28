import { EXTENSION_MESSAGE_TYPES, type ContentScriptReadyMessage, type GatewayProxyRequestMessage, type PingMessage } from './messages.js';

const LOG_PREFIX = '[cwmb extension]';

chrome.runtime.onInstalled.addListener(() => {
  console.log(`${LOG_PREFIX} service worker installed`);
});

chrome.runtime.onStartup.addListener(() => {
  console.log(`${LOG_PREFIX} service worker startup`);
});

chrome.runtime.onMessage.addListener((message: PingMessage | GatewayProxyRequestMessage | ContentScriptReadyMessage, sender: any, sendResponse: (response: unknown) => void) => {
  if (!message || typeof message !== 'object' || !('type' in message)) {
    return false;
  }

  if (message.type === EXTENSION_MESSAGE_TYPES.ping) {
    console.log(`${LOG_PREFIX} lifecycle ping from content script`);
    sendResponse({ ok: true, receivedAt: Date.now() });
    return false;
  }

  if (message.type === EXTENSION_MESSAGE_TYPES.contentScriptReady) {
    console.log(`${LOG_PREFIX} content script ready`, {
      path: message.path,
      hasDomAccess: message.hasDomAccess,
      tabId: sender?.tab?.id
    });
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === EXTENSION_MESSAGE_TYPES.gatewayRequest) {
    void proxyGatewayRequest(message)
      .then((response) => sendResponse(response))
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Gateway proxy failed'
        });
      });
    return true;
  }

  return false;
});

async function proxyGatewayRequest(message: GatewayProxyRequestMessage): Promise<unknown> {
  const controller = new AbortController();
  const timeoutMs = typeof message.request.timeout === 'number' ? message.request.timeout : 15_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(message.request.url, {
      method: message.request.method,
      body: message.request.data,
      headers: message.request.headers,
      signal: controller.signal
    });
    const responseText = await response.text();
    return {
      ok: true,
      status: response.status,
      responseText
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        ok: false,
        timedOut: true
      };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Gateway request failed'
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
