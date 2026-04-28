import type { CatalogSource } from '@cwmb/tool-contracts';
import { chatgptConversationPaths, chatgptRequestPromptAttributes } from './chatgpt-runtime-facts.js';
import {
  createEmptyRequestPromptSnapshot,
  normalizeRequestInjectionMode,
  type RequestHookStatus,
  type RequestInjectionMode,
  type RequestPromptSnapshot
} from './request-injection-state.js';
import {
  createSyntheticContent,
  createSyntheticSystemMessage,
  extractPromptMarker,
  injectCatalogIntoPayload,
  injectCatalogIntoRequestBody,
  isUserMessage,
  messageContainsPrompt,
  prependPrompt,
  tryInjectIntoContentParts,
  tryInjectIntoMessage,
  tryInjectIntoMessageContent,
  tryInjectIntoMessageList,
  tryInjectIntoRootFields,
  tryInjectIntoTypedContent,
  tryInjectSyntheticSystemMessage,
  type RequestBodyInjectionResult
} from '../../extension/src/injection-runtime/request-body-injection.js';

const REQUEST_PROMPT_ATTRIBUTE = chatgptRequestPromptAttributes.prompt;
const REQUEST_PROMPT_MODE_ATTRIBUTE = chatgptRequestPromptAttributes.mode;
const REQUEST_PROMPT_SOURCE_ATTRIBUTE = chatgptRequestPromptAttributes.source;
const REQUEST_PROMPT_CATALOG_VERSION_ATTRIBUTE = chatgptRequestPromptAttributes.catalogVersion;
const REQUEST_PROMPT_MESSAGE_TYPE = 'cwmb:update-request-prompt';
const REQUEST_HOOK_STATUS_MESSAGE_TYPE = 'cwmb:request-hook-status';

declare const unsafeWindow: (Window & typeof globalThis) | undefined;
declare const CHATGPT_CONVERSATION_PATHS: readonly string[] | undefined;

let directHookSnapshot = createEmptyRequestPromptSnapshot('synthetic_system');

export type { RequestBodyInjectionResult, RequestHookStatus, RequestInjectionMode, RequestPromptSnapshot };

export function installPageRequestHook(): void {
  const pageWindow = getPageWindow();
  if (pageWindow) {
    installRequestHookOnTarget(pageWindow, () => directHookSnapshot.prompt ? directHookSnapshot : readPromptSnapshotFromDom());
    return;
  }

  if (document.documentElement.dataset.cwmbRequestHookInstalled === 'true') {
    return;
  }

  const script = document.createElement('script');
  script.dataset.cwmbRequestHook = 'true';
  script.textContent = buildPageHookSource();
  (document.documentElement || document.head).appendChild(script);
  script.remove();
  document.documentElement.dataset.cwmbRequestHookInstalled = 'true';
}

export function syncRequestPrompt(snapshot: RequestPromptSnapshot): void {
  directHookSnapshot = snapshot;
  applyPromptSnapshotToDom(snapshot);
  window.postMessage({
    source: 'cwmb-userscript',
    type: REQUEST_PROMPT_MESSAGE_TYPE,
    prompt: snapshot.prompt,
    mode: snapshot.mode,
    promptSource: snapshot.source,
    catalogVersion: snapshot.catalogVersion
  }, window.location.origin);
}

export function isChatGptConversationRequest(url: string, method: string): boolean {
  if (method.toUpperCase() !== 'POST') {
    return false;
  }

  try {
    const parsed = new URL(url, window.location.href);
    return matchesConversationPath(parsed.pathname);
  } catch {
    return matchConversationUrlFallback(url);
  }
}

function matchesConversationPath(pathname: string): boolean {
  return getConversationPaths().includes(pathname);
}

function matchConversationUrlFallback(url: string): boolean {
  return getConversationPaths().some((path) => {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|https?:\\/\\/[^/]+)${escaped}(?:$|[?#])`);
    return pattern.test(url);
  });
}

function getConversationPaths(): readonly string[] {
  return typeof CHATGPT_CONVERSATION_PATHS !== 'undefined' ? CHATGPT_CONVERSATION_PATHS : chatgptConversationPaths;
}

function getPageWindow(): (Window & typeof globalThis) | undefined {
  try {
    return typeof unsafeWindow !== 'undefined' ? unsafeWindow : undefined;
  } catch {
    return undefined;
  }
}

function applyPromptSnapshotToDom(snapshot: RequestPromptSnapshot): void {
  document.documentElement.setAttribute(REQUEST_PROMPT_ATTRIBUTE, snapshot.prompt);
  document.documentElement.setAttribute(REQUEST_PROMPT_MODE_ATTRIBUTE, snapshot.mode);
  setOptionalPromptAttribute(REQUEST_PROMPT_SOURCE_ATTRIBUTE, snapshot.source);
  setOptionalPromptAttribute(REQUEST_PROMPT_CATALOG_VERSION_ATTRIBUTE, snapshot.catalogVersion);
}

function setOptionalPromptAttribute(name: string, value: string | undefined): void {
  if (value) {
    document.documentElement.setAttribute(name, value);
    return;
  }

  document.documentElement.removeAttribute(name);
}

function readPromptSnapshotFromDom(): RequestPromptSnapshot {
  return {
    prompt: document.documentElement.getAttribute(REQUEST_PROMPT_ATTRIBUTE) || '',
    mode: normalizeRequestInjectionMode(document.documentElement.getAttribute(REQUEST_PROMPT_MODE_ATTRIBUTE)),
    source: normalizeCatalogSource(document.documentElement.getAttribute(REQUEST_PROMPT_SOURCE_ATTRIBUTE)),
    catalogVersion: document.documentElement.getAttribute(REQUEST_PROMPT_CATALOG_VERSION_ATTRIBUTE) || undefined
  };
}

function normalizeCatalogSource(value: string | null | undefined): CatalogSource | undefined {
  return value === 'cache' || value === 'live' ? value : undefined;
}

function emitRequestHookStatus(
  status: RequestHookStatus,
  transport: 'fetch' | 'xhr',
  url: string,
  snapshot: RequestPromptSnapshot
): void {
  window.postMessage({
    source: 'cwmb-page-hook',
    type: REQUEST_HOOK_STATUS_MESSAGE_TYPE,
    status,
    transport,
    url,
    promptSource: snapshot.source,
    catalogVersion: snapshot.catalogVersion
  }, window.location.origin);
}

function installRequestHookOnTarget(
  targetWindow: Window & typeof globalThis,
  readInjectionState: () => RequestPromptSnapshot
): void {
  if ((targetWindow as Window & { __cwmbRequestHookInstalled?: boolean }).__cwmbRequestHookInstalled) {
    return;
  }
  (targetWindow as Window & { __cwmbRequestHookInstalled?: boolean }).__cwmbRequestHookInstalled = true;

  const originalFetch = targetWindow.fetch;
  if (typeof originalFetch === 'function') {
    targetWindow.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
      let method = init && typeof init.method === 'string' ? init.method : 'GET';
      let url = typeof input === 'string' ? input : input instanceof targetWindow.Request ? input.url : String(input);
      if (input instanceof targetWindow.Request) {
        method = input.method || method;
      }

      const matched = isChatGptConversationRequest(url, method);
      if (!matched) {
        return originalFetch.apply(this, arguments as unknown as [input: RequestInfo | URL, init?: RequestInit]);
      }

      const snapshot = readInjectionState();
      if (!snapshot.prompt) {
        emitRequestHookStatus('missing_prompt', 'fetch', url, snapshot);
        return originalFetch.apply(this, arguments as unknown as [input: RequestInfo | URL, init?: RequestInit]);
      }

      if (input instanceof targetWindow.Request) {
        try {
          const cloned = input.clone();
          const bodyText = await cloned.text();
          const next = injectCatalogIntoRequestBody(bodyText, snapshot.prompt, snapshot.mode);
          if (next.injected) {
            emitRequestHookStatus('injected', 'fetch', url, snapshot);
            const request = new targetWindow.Request(input, { body: next.bodyText });
            return originalFetch.call(this, request);
          }
          emitRequestHookStatus('matched_without_injection', 'fetch', url, snapshot);
        } catch {
          emitRequestHookStatus('matched_without_injection', 'fetch', url, snapshot);
        }
        return originalFetch.apply(this, arguments as unknown as [input: RequestInfo | URL, init?: RequestInit]);
      }

      if (init && typeof init.body === 'string') {
        const next = injectCatalogIntoRequestBody(init.body, snapshot.prompt, snapshot.mode);
        if (next.injected) {
          emitRequestHookStatus('injected', 'fetch', url, snapshot);
          init.body = next.bodyText;
        } else {
          emitRequestHookStatus('matched_without_injection', 'fetch', url, snapshot);
        }
      } else {
        emitRequestHookStatus('matched_without_injection', 'fetch', url, snapshot);
      }

      return originalFetch.call(this, input, init);
    };
  }

  const originalOpen = targetWindow.XMLHttpRequest.prototype.open;
  const originalSend = targetWindow.XMLHttpRequest.prototype.send;
  const requestMeta = new WeakMap<XMLHttpRequest, { method: string; url: string }>();

  targetWindow.XMLHttpRequest.prototype.open = function(method: string, url: string | URL) {
    requestMeta.set(this, { method: String(method || 'GET'), url: String(url || '') });
    return originalOpen.apply(this, arguments as unknown as Parameters<XMLHttpRequest['open']>);
  };

  targetWindow.XMLHttpRequest.prototype.send = function(body?: XMLHttpRequestBodyInit | Document | null) {
    const meta = requestMeta.get(this);
    if (meta && isChatGptConversationRequest(meta.url, meta.method)) {
      const snapshot = readInjectionState();
      if (!snapshot.prompt) {
        emitRequestHookStatus('missing_prompt', 'xhr', meta.url, snapshot);
      } else if (typeof body === 'string') {
        const next = injectCatalogIntoRequestBody(body, snapshot.prompt, snapshot.mode);
        if (next.injected) {
          emitRequestHookStatus('injected', 'xhr', meta.url, snapshot);
          body = next.bodyText;
        } else {
          emitRequestHookStatus('matched_without_injection', 'xhr', meta.url, snapshot);
        }
      } else {
        emitRequestHookStatus('matched_without_injection', 'xhr', meta.url, snapshot);
      }
    }
    return originalSend.call(this, body);
  };
}

function buildPageHookSource(): string {
  return `(() => {
    if (window.__cwmbRequestHookInstalled) return;
    window.__cwmbRequestHookInstalled = true;
    const CHATGPT_CONVERSATION_PATHS = ${JSON.stringify(chatgptConversationPaths)};
    const REQUEST_PROMPT_ATTRIBUTE = ${JSON.stringify(REQUEST_PROMPT_ATTRIBUTE)};
    const REQUEST_PROMPT_MODE_ATTRIBUTE = ${JSON.stringify(REQUEST_PROMPT_MODE_ATTRIBUTE)};
    const REQUEST_PROMPT_SOURCE_ATTRIBUTE = ${JSON.stringify(REQUEST_PROMPT_SOURCE_ATTRIBUTE)};
    const REQUEST_PROMPT_CATALOG_VERSION_ATTRIBUTE = ${JSON.stringify(REQUEST_PROMPT_CATALOG_VERSION_ATTRIBUTE)};
    const REQUEST_PROMPT_MESSAGE_TYPE = ${JSON.stringify(REQUEST_PROMPT_MESSAGE_TYPE)};
    const REQUEST_HOOK_STATUS_MESSAGE_TYPE = ${JSON.stringify(REQUEST_HOOK_STATUS_MESSAGE_TYPE)};
    let currentPrompt = '';
    let currentMode = 'synthetic_system';
    let currentPromptSource;
    let currentCatalogVersion;
    const readPromptFromDom = () => document.documentElement.getAttribute(REQUEST_PROMPT_ATTRIBUTE) || '';
    ${normalizeRequestInjectionMode.toString()}
    const normalizeCatalogSource = (value) => value === 'cache' || value === 'live' ? value : undefined;
    const readModeFromDom = () => normalizeRequestInjectionMode(document.documentElement.getAttribute(REQUEST_PROMPT_MODE_ATTRIBUTE));
    const readPromptSourceFromDom = () => normalizeCatalogSource(document.documentElement.getAttribute(REQUEST_PROMPT_SOURCE_ATTRIBUTE));
    const readCatalogVersionFromDom = () => document.documentElement.getAttribute(REQUEST_PROMPT_CATALOG_VERSION_ATTRIBUTE) || undefined;
    const emitRequestHookStatus = (status, transport, url) => {
      window.postMessage({
        source: 'cwmb-page-hook',
        type: REQUEST_HOOK_STATUS_MESSAGE_TYPE,
        status,
        transport,
        url,
        promptSource: currentPromptSource,
        catalogVersion: currentCatalogVersion
      }, window.location.origin);
    };
    ${getConversationPaths.toString()}
    ${matchesConversationPath.toString()}
    ${matchConversationUrlFallback.toString()}
    ${isChatGptConversationRequest.toString()}
    ${injectCatalogIntoRequestBody.toString()}
    ${injectCatalogIntoPayload.toString()}
    ${tryInjectSyntheticSystemMessage.toString()}
    ${messageContainsPrompt.toString()}
    ${createSyntheticSystemMessage.toString()}
    ${createSyntheticContent.toString()}
    ${tryInjectIntoMessageList.toString()}
    ${isUserMessage.toString()}
    ${tryInjectIntoMessage.toString()}
    ${tryInjectIntoMessageContent.toString()}
    ${tryInjectIntoContentParts.toString()}
    ${tryInjectIntoTypedContent.toString()}
    ${tryInjectIntoRootFields.toString()}
    ${prependPrompt.toString()}
    ${extractPromptMarker.toString()}
    currentPrompt = readPromptFromDom();
    currentMode = readModeFromDom();
    currentPromptSource = readPromptSourceFromDom();
    currentCatalogVersion = readCatalogVersionFromDom();
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.source !== 'cwmb-userscript' || data.type !== REQUEST_PROMPT_MESSAGE_TYPE) return;
      currentPrompt = typeof data.prompt === 'string' ? data.prompt : '';
      currentMode = normalizeRequestInjectionMode(data.mode);
      currentPromptSource = normalizeCatalogSource(data.promptSource);
      currentCatalogVersion = typeof data.catalogVersion === 'string' && data.catalogVersion ? data.catalogVersion : undefined;
    });
    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
      window.fetch = async function(input, init) {
        let method = init && typeof init.method === 'string' ? init.method : 'GET';
        let url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        if (input instanceof Request) {
          method = input.method || method;
        }
        const matched = isChatGptConversationRequest(url, method);
        if (!matched) {
          return originalFetch.apply(this, arguments);
        }
        if (!currentPrompt) {
          emitRequestHookStatus('missing_prompt', 'fetch', url);
          return originalFetch.apply(this, arguments);
        }
        if (input instanceof Request) {
          try {
            const cloned = input.clone();
            const bodyText = await cloned.text();
            const next = injectCatalogIntoRequestBody(bodyText, currentPrompt, currentMode);
            if (next.injected) {
              emitRequestHookStatus('injected', 'fetch', url);
              const request = new Request(input, { body: next.bodyText });
              return originalFetch.call(this, request);
            }
            emitRequestHookStatus('matched_without_injection', 'fetch', url);
          } catch {
            emitRequestHookStatus('matched_without_injection', 'fetch', url);
          }
          return originalFetch.apply(this, arguments);
        }
        if (init && typeof init.body === 'string') {
          const next = injectCatalogIntoRequestBody(init.body, currentPrompt, currentMode);
          if (next.injected) {
            emitRequestHookStatus('injected', 'fetch', url);
            init.body = next.bodyText;
          } else {
            emitRequestHookStatus('matched_without_injection', 'fetch', url);
          }
        } else {
          emitRequestHookStatus('matched_without_injection', 'fetch', url);
        }
        return originalFetch.call(this, input, init);
      };
    }
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const requestMeta = new WeakMap();
    XMLHttpRequest.prototype.open = function(method, url) {
      requestMeta.set(this, { method: String(method || 'GET'), url: String(url || '') });
      return originalOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body) {
      const meta = requestMeta.get(this);
      if (meta && isChatGptConversationRequest(meta.url, meta.method)) {
        if (!currentPrompt) {
          emitRequestHookStatus('missing_prompt', 'xhr', meta.url);
        } else if (typeof body === 'string') {
          const next = injectCatalogIntoRequestBody(body, currentPrompt, currentMode);
          if (next.injected) {
            emitRequestHookStatus('injected', 'xhr', meta.url);
            body = next.bodyText;
          } else {
            emitRequestHookStatus('matched_without_injection', 'xhr', meta.url);
          }
        } else {
          emitRequestHookStatus('matched_without_injection', 'xhr', meta.url);
        }
      }
      return originalSend.call(this, body);
    };
  })();`;
}
