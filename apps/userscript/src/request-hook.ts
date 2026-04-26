const CHATGPT_CONVERSATION_PATHS = [
  '/backend-api/conversation',
  '/backend-anon/conversation',
  '/backend-api/f/conversation'
] as const;

const REQUEST_PROMPT_ATTRIBUTE = 'data-cwmb-request-prompt';
const REQUEST_PROMPT_MESSAGE_TYPE = 'cwmb:update-request-prompt';
const REQUEST_HOOK_STATUS_MESSAGE_TYPE = 'cwmb:request-hook-status';

declare const unsafeWindow: (Window & typeof globalThis) | undefined;

let directHookPrompt = '';
let directHookMode: RequestInjectionMode = 'synthetic_system';

export interface RequestBodyInjectionResult {
  bodyText: string;
  injected: boolean;
}

export type RequestHookStatus = 'injected' | 'missing_prompt' | 'matched_without_injection';
export type RequestInjectionMode = 'prepend_user' | 'synthetic_system';

export function installPageRequestHook(): void {
  const pageWindow = getPageWindow();
  if (pageWindow) {
    installRequestHookOnTarget(pageWindow, () => ({
      prompt: directHookPrompt || readPromptFromDom(),
      mode: directHookMode || readModeFromDom()
    }));
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

export function syncRequestPrompt(prompt: string, mode: RequestInjectionMode): void {
  directHookPrompt = prompt;
  directHookMode = mode;
  document.documentElement.setAttribute(REQUEST_PROMPT_ATTRIBUTE, prompt);
  document.documentElement.setAttribute(`${REQUEST_PROMPT_ATTRIBUTE}-mode`, mode);
  window.postMessage({
    source: 'cwmb-userscript',
    type: REQUEST_PROMPT_MESSAGE_TYPE,
    prompt,
    mode
  }, window.location.origin);
}

export function isChatGptConversationRequest(url: string, method: string): boolean {
  if (method.toUpperCase() !== 'POST') {
    return false;
  }

  try {
    const parsed = new URL(url, window.location.href);
    return CHATGPT_CONVERSATION_PATHS.some((path) => parsed.pathname.includes(path));
  } catch {
    return CHATGPT_CONVERSATION_PATHS.some((path) => url.includes(path));
  }
}

export function injectCatalogIntoRequestBody(
  bodyText: string,
  prompt: string,
  mode: RequestInjectionMode = 'prepend_user'
): RequestBodyInjectionResult {
  if (!bodyText || !prompt.trim()) {
    return { bodyText, injected: false };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return { bodyText, injected: false };
  }

  if (!payload || typeof payload !== 'object') {
    return { bodyText, injected: false };
  }

  const injected = injectCatalogIntoPayload(payload as Record<string, unknown>, prompt, mode);
  return injected
    ? { bodyText: JSON.stringify(payload), injected: true }
    : { bodyText, injected: false };
}

function getPageWindow(): (Window & typeof globalThis) | undefined {
  try {
    return typeof unsafeWindow !== 'undefined' ? unsafeWindow : undefined;
  } catch {
    return undefined;
  }
}

function readPromptFromDom(): string {
  return document.documentElement.getAttribute(REQUEST_PROMPT_ATTRIBUTE) || '';
}

function readModeFromDom(): RequestInjectionMode {
  return document.documentElement.getAttribute(`${REQUEST_PROMPT_ATTRIBUTE}-mode`) === 'prepend_user'
    ? 'prepend_user'
    : 'synthetic_system';
}

function emitRequestHookStatus(status: RequestHookStatus, transport: 'fetch' | 'xhr', url: string): void {
  window.postMessage({
    source: 'cwmb-page-hook',
    type: REQUEST_HOOK_STATUS_MESSAGE_TYPE,
    status,
    transport,
    url
  }, window.location.origin);
}

function installRequestHookOnTarget(
  targetWindow: Window & typeof globalThis,
  readInjectionState: () => { prompt: string; mode: RequestInjectionMode }
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

      const { prompt, mode } = readInjectionState();
      if (!prompt) {
        emitRequestHookStatus('missing_prompt', 'fetch', url);
        return originalFetch.apply(this, arguments as unknown as [input: RequestInfo | URL, init?: RequestInit]);
      }

      if (input instanceof targetWindow.Request) {
        try {
          const cloned = input.clone();
          const bodyText = await cloned.text();
          const next = injectCatalogIntoRequestBody(bodyText, prompt, mode);
          if (next.injected) {
            emitRequestHookStatus('injected', 'fetch', url);
            const request = new targetWindow.Request(input, { body: next.bodyText });
            return originalFetch.call(this, request);
          }
          emitRequestHookStatus('matched_without_injection', 'fetch', url);
        } catch {
          emitRequestHookStatus('matched_without_injection', 'fetch', url);
        }
        return originalFetch.apply(this, arguments as unknown as [input: RequestInfo | URL, init?: RequestInit]);
      }

      if (init && typeof init.body === 'string') {
        const next = injectCatalogIntoRequestBody(init.body, prompt, mode);
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
      const { prompt, mode } = readInjectionState();
      if (!prompt) {
        emitRequestHookStatus('missing_prompt', 'xhr', meta.url);
      } else if (typeof body === 'string') {
        const next = injectCatalogIntoRequestBody(body, prompt, mode);
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

function injectCatalogIntoPayload(payload: Record<string, unknown>, prompt: string, mode: RequestInjectionMode): boolean {
  if (mode === 'synthetic_system' && Array.isArray(payload.messages)) {
    const systemInjection = tryInjectSyntheticSystemMessage(payload.messages, prompt);
    if (systemInjection === 'inserted') {
      return true;
    }
    if (systemInjection === 'present') {
      return false;
    }
  }

  if (Array.isArray(payload.messages) && tryInjectIntoMessageList(payload.messages, prompt)) {
    return true;
  }

  return tryInjectIntoRootFields(payload, prompt);
}

function tryInjectIntoMessageList(messages: unknown[], prompt: string): boolean {
  const preferred = messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => isUserMessage(message))
    .reverse();

  for (const { message } of preferred) {
    if (tryInjectIntoMessage(message, prompt)) {
      return true;
    }
  }

  for (const message of [...messages].reverse()) {
    if (tryInjectIntoMessage(message, prompt)) {
      return true;
    }
  }

  return false;
}

function tryInjectSyntheticSystemMessage(messages: unknown[], prompt: string): 'inserted' | 'present' | 'failed' {
  const promptMarker = extractPromptMarker(prompt);
  if (messages.some((message) => messageContainsPrompt(message, prompt, promptMarker))) {
    return 'present';
  }

  const firstUserIndex = messages.findIndex((message) => isUserMessage(message));
  const reference = messages[firstUserIndex] ?? messages[0];
  const syntheticMessage = createSyntheticSystemMessage(reference, prompt);
  if (!syntheticMessage) {
    return 'failed';
  }

  messages.splice(firstUserIndex >= 0 ? firstUserIndex : 0, 0, syntheticMessage);
  return 'inserted';
}

function messageContainsPrompt(message: unknown, prompt: string, promptMarker: string): boolean {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const record = message as Record<string, unknown>;
  const content = record.content;
  if (typeof content === 'string') {
    return content.includes(prompt) || (promptMarker ? content.includes(promptMarker) : false);
  }
  if (Array.isArray(content)) {
    return content.some((part) => part && typeof part === 'object'
      && typeof (part as Record<string, unknown>).text === 'string'
      && (((part as Record<string, unknown>).text as string).includes(prompt)
        || (promptMarker ? ((part as Record<string, unknown>).text as string).includes(promptMarker) : false)));
  }
  if (content && typeof content === 'object') {
    const contentRecord = content as Record<string, unknown>;
    if (typeof contentRecord.text === 'string' && (contentRecord.text.includes(prompt) || (promptMarker ? contentRecord.text.includes(promptMarker) : false))) {
      return true;
    }
    if (Array.isArray(contentRecord.parts)) {
      return contentRecord.parts.some((part) => typeof part === 'string' && (part.includes(prompt) || (promptMarker ? part.includes(promptMarker) : false)));
    }
  }
  return false;
}

function createSyntheticSystemMessage(reference: unknown, prompt: string): Record<string, unknown> {
  if (reference && typeof reference === 'object') {
    const record = reference as Record<string, unknown>;
    if (typeof record.role === 'string') {
      return {
        role: 'system',
        content: createSyntheticContent(record.content, prompt),
        metadata: { cwmbSyntheticSystem: true }
      };
    }

    if (record.author && typeof record.author === 'object') {
      return {
        author: { role: 'system' },
        content: createSyntheticContent(record.content, prompt),
        metadata: { cwmbSyntheticSystem: true }
      };
    }
  }

  return {
    role: 'system',
    content: prompt,
    metadata: { cwmbSyntheticSystem: true }
  };
}

function createSyntheticContent(content: unknown, prompt: string): unknown {
  if (typeof content === 'string') {
    return prompt;
  }
  if (Array.isArray(content)) {
    return [{ type: 'text', text: prompt }];
  }
  if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>;
    if (Array.isArray(record.parts)) {
      return {
        ...record,
        parts: [prompt]
      };
    }
    if (typeof record.text === 'string') {
      return {
        ...record,
        text: prompt
      };
    }
  }

  return {
    content_type: 'text',
    parts: [prompt]
  };
}

function isUserMessage(message: unknown): boolean {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const record = message as Record<string, unknown>;
  const role = record.role;
  if (typeof role === 'string') {
    return role === 'user';
  }

  const author = record.author;
  if (!author || typeof author !== 'object') {
    return false;
  }

  return (author as Record<string, unknown>).role === 'user';
}

function tryInjectIntoMessage(message: unknown, prompt: string): boolean {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const record = message as Record<string, unknown>;
  if (typeof record.content === 'string') {
    const next = prependPrompt(record.content, prompt);
    if (!next.modified) {
      return false;
    }
    record.content = next.value;
    return true;
  }

  if (!record.content || typeof record.content !== 'object') {
    return false;
  }

  return tryInjectIntoMessageContent(record.content as Record<string, unknown>, prompt);
}

function tryInjectIntoMessageContent(content: Record<string, unknown>, prompt: string): boolean {
  if (tryInjectIntoContentParts(content, prompt)) {
    return true;
  }

  if (typeof content.text === 'string') {
    const next = prependPrompt(content.text, prompt);
    if (!next.modified) {
      return false;
    }
    content.text = next.value;
    return true;
  }

  if (Array.isArray(content.parts)) {
    return tryInjectIntoTypedContent(content.parts, prompt);
  }

  return Array.isArray(content)
    ? tryInjectIntoTypedContent(content, prompt)
    : false;
}

function tryInjectIntoContentParts(content: Record<string, unknown>, prompt: string): boolean {
  const parts = content.parts;
  if (!Array.isArray(parts)) {
    return false;
  }

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (typeof part !== 'string') {
      continue;
    }

    const next = prependPrompt(part, prompt);
    if (!next.modified) {
      return false;
    }
    parts[index] = next.value;
    return true;
  }

  return tryInjectIntoTypedContent(parts, prompt);
}

function tryInjectIntoTypedContent(contentParts: unknown[], prompt: string): boolean {
  for (const part of contentParts) {
    if (!part || typeof part !== 'object') {
      continue;
    }

    const record = part as Record<string, unknown>;
    if (record.type !== 'text' || typeof record.text !== 'string') {
      continue;
    }

    const next = prependPrompt(record.text, prompt);
    if (!next.modified) {
      return false;
    }
    record.text = next.value;
    return true;
  }

  return false;
}

function tryInjectIntoRootFields(payload: Record<string, unknown>, prompt: string): boolean {
  for (const field of ['prompt', 'input']) {
    const current = payload[field];
    if (typeof current !== 'string') {
      continue;
    }

    const next = prependPrompt(current, prompt);
    if (!next.modified) {
      return false;
    }
    payload[field] = next.value;
    return true;
  }

  return false;
}

function prependPrompt(target: string, prompt: string): { value: string; modified: boolean } {
  const promptMarker = extractPromptMarker(prompt);
  if (!target.trim()) {
    return { value: prompt, modified: true };
  }
  if ((promptMarker && target.includes(promptMarker)) || target.includes(prompt)) {
    return { value: target, modified: false };
  }
  return {
    value: `${prompt}\n\n---\n\n${target}`,
    modified: true
  };
}

function extractPromptMarker(prompt: string): string {
  return prompt.split('\n', 1)[0]?.trim() ?? '';
}

function buildPageHookSource(): string {
  return `(() => {
    if (window.__cwmbRequestHookInstalled) return;
    window.__cwmbRequestHookInstalled = true;
    const CHATGPT_CONVERSATION_PATHS = ${JSON.stringify(CHATGPT_CONVERSATION_PATHS)};
    const REQUEST_PROMPT_ATTRIBUTE = ${JSON.stringify(REQUEST_PROMPT_ATTRIBUTE)};
    const REQUEST_PROMPT_MESSAGE_TYPE = ${JSON.stringify(REQUEST_PROMPT_MESSAGE_TYPE)};
    const REQUEST_HOOK_STATUS_MESSAGE_TYPE = ${JSON.stringify(REQUEST_HOOK_STATUS_MESSAGE_TYPE)};
    let currentPrompt = '';
    let currentMode = 'synthetic_system';
    const readPromptFromDom = () => document.documentElement.getAttribute(REQUEST_PROMPT_ATTRIBUTE) || '';
    const readModeFromDom = () => document.documentElement.getAttribute(REQUEST_PROMPT_ATTRIBUTE + '-mode') === 'prepend_user' ? 'prepend_user' : 'synthetic_system';
    const emitRequestHookStatus = (status, transport, url) => {
      window.postMessage({
        source: 'cwmb-page-hook',
        type: REQUEST_HOOK_STATUS_MESSAGE_TYPE,
        status,
        transport,
        url
      }, window.location.origin);
    };
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
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.source !== 'cwmb-userscript' || data.type !== REQUEST_PROMPT_MESSAGE_TYPE) return;
      currentPrompt = typeof data.prompt === 'string' ? data.prompt : '';
      currentMode = data.mode === 'prepend_user' ? 'prepend_user' : 'synthetic_system';
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
          } catch {}
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
