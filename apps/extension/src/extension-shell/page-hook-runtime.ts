import { chatgptConversationPaths, chatgptRequestPromptAttributes } from '../chatgpt-adapter/chatgpt-runtime-facts.js';
import {
  createSyntheticContent,
  createSyntheticSystemMessage,
  extractPromptMarker,
  injectCatalogIntoRequestBody,
  injectCatalogIntoPayload,
  isUserMessage,
  messageContainsPrompt,
  prependPrompt,
  tryInjectIntoContentParts,
  tryInjectIntoMessage,
  tryInjectIntoMessageContent,
  tryInjectIntoMessageList,
  tryInjectIntoRootFields,
  tryInjectIntoTypedContent
} from '../injection-runtime/request-body-injection.js';
import { normalizeRequestInjectionMode } from '../injection-runtime/request-injection-state.js';

const REQUEST_PROMPT_ATTRIBUTE = chatgptRequestPromptAttributes.prompt;
const REQUEST_PROMPT_MODE_ATTRIBUTE = chatgptRequestPromptAttributes.mode;
const REQUEST_PROMPT_SOURCE_ATTRIBUTE = chatgptRequestPromptAttributes.source;
const REQUEST_PROMPT_CATALOG_VERSION_ATTRIBUTE = chatgptRequestPromptAttributes.catalogVersion;
const REQUEST_PROMPT_MESSAGE_TYPE = 'cwmb:update-request-prompt';
const REQUEST_HOOK_STATUS_MESSAGE_TYPE = 'cwmb:request-hook-status';
type RequestInjectionMode = ReturnType<typeof normalizeRequestInjectionMode>;

export function installMainWorldRequestHook(targetWindow: Window & typeof globalThis): void {
  if ((targetWindow as Window & { __cwmbRequestHookInstalled?: boolean }).__cwmbRequestHookInstalled) {
    return;
  }
  (targetWindow as Window & { __cwmbRequestHookInstalled?: boolean }).__cwmbRequestHookInstalled = true;
  if (document.documentElement) {
    document.documentElement.dataset.cwmbRequestHookInstalled = 'true';
  }

  let currentPrompt = readPromptFromDom();
  let currentMode: RequestInjectionMode = readModeFromDom();
  let currentPromptSource = readPromptSourceFromDom();
  let currentCatalogVersion = readCatalogVersionFromDom();

  targetWindow.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== targetWindow) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if ((data as { source?: string }).source !== 'cwmb-userscript' || (data as { type?: string }).type !== REQUEST_PROMPT_MESSAGE_TYPE) {
      return;
    }
    currentPrompt = typeof (data as { prompt?: unknown }).prompt === 'string' ? String((data as { prompt: unknown }).prompt) : '';
    currentMode = normalizeRequestInjectionMode((data as { mode?: string }).mode);
    currentPromptSource = normalizeCatalogSource((data as { promptSource?: string }).promptSource);
    currentCatalogVersion = typeof (data as { catalogVersion?: unknown }).catalogVersion === 'string' && (data as { catalogVersion: string }).catalogVersion
      ? (data as { catalogVersion: string }).catalogVersion
      : undefined;
  });

  const emitRequestHookStatus = (status: string, transport: 'fetch' | 'xhr', url: string): void => {
    targetWindow.postMessage({
      source: 'cwmb-page-hook',
      type: REQUEST_HOOK_STATUS_MESSAGE_TYPE,
      status,
      transport,
      url,
      promptSource: currentPromptSource,
      catalogVersion: currentCatalogVersion
    }, targetWindow.location.origin);
  };

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
        return originalFetch.call(this, input, init);
      }

      if (!currentPrompt) {
        emitRequestHookStatus('missing_prompt', 'fetch', url,);
        return originalFetch.call(this, input, init);
      }

      if (input instanceof targetWindow.Request) {
        try {
          const cloned = input.clone();
          const bodyText = await cloned.text();
          const next = injectCatalogIntoRequestBody(bodyText, currentPrompt, currentMode);
          if (next.injected) {
            emitRequestHookStatus('injected', 'fetch', url);
            const request = new targetWindow.Request(input, { body: next.bodyText });
            return originalFetch.call(this, request);
          }
          emitRequestHookStatus('matched_without_injection', 'fetch', url);
        } catch {
          emitRequestHookStatus('matched_without_injection', 'fetch', url);
        }
        return originalFetch.call(this, input, init);
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

function readPromptFromDom(): string {
  return document.documentElement?.getAttribute(REQUEST_PROMPT_ATTRIBUTE) || '';
}

function readModeFromDom(): RequestInjectionMode {
  return normalizeRequestInjectionMode(document.documentElement?.getAttribute(REQUEST_PROMPT_MODE_ATTRIBUTE));
}

function readPromptSourceFromDom(): 'cache' | 'live' | undefined {
  return normalizeCatalogSource(document.documentElement?.getAttribute(REQUEST_PROMPT_SOURCE_ATTRIBUTE));
}

function readCatalogVersionFromDom(): string | undefined {
  return document.documentElement?.getAttribute(REQUEST_PROMPT_CATALOG_VERSION_ATTRIBUTE) || undefined;
}

function normalizeCatalogSource(value: string | null | undefined): 'cache' | 'live' | undefined {
  return value === 'cache' || value === 'live' ? value : undefined;
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
  return chatgptConversationPaths;
}
