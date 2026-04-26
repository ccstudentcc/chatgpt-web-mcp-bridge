const CHATGPT_CONVERSATION_PATHS = [
  '/backend-api/conversation',
  '/backend-anon/conversation',
  '/backend-api/f/conversation'
] as const;

export interface RequestBodyInjectionResult {
  bodyText: string;
  injected: boolean;
}

export function installPageRequestHook(): void {
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

export function syncRequestPrompt(prompt: string): void {
  window.dispatchEvent(new CustomEvent('cwmb:update-request-prompt', {
    detail: { prompt }
  }));
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

export function injectCatalogIntoRequestBody(bodyText: string, prompt: string): RequestBodyInjectionResult {
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

  const injected = injectCatalogIntoPayload(payload as Record<string, unknown>, prompt);
  return injected
    ? { bodyText: JSON.stringify(payload), injected: true }
    : { bodyText, injected: false };
}

function injectCatalogIntoPayload(payload: Record<string, unknown>, prompt: string): boolean {
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
    let currentPrompt = '';
    ${isChatGptConversationRequest.toString()}
    ${injectCatalogIntoRequestBody.toString()}
    ${injectCatalogIntoPayload.toString()}
    ${tryInjectIntoMessageList.toString()}
    ${isUserMessage.toString()}
    ${tryInjectIntoMessage.toString()}
    ${tryInjectIntoMessageContent.toString()}
    ${tryInjectIntoContentParts.toString()}
    ${tryInjectIntoTypedContent.toString()}
    ${tryInjectIntoRootFields.toString()}
    ${prependPrompt.toString()}
    ${extractPromptMarker.toString()}
    window.addEventListener('cwmb:update-request-prompt', (event) => {
      const detail = event && typeof event === 'object' && 'detail' in event ? event.detail : undefined;
      currentPrompt = detail && typeof detail.prompt === 'string' ? detail.prompt : '';
    });
    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
      window.fetch = async function(input, init) {
        let method = init && typeof init.method === 'string' ? init.method : 'GET';
        let url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        if (input instanceof Request) {
          method = input.method || method;
        }
        if (!currentPrompt || !isChatGptConversationRequest(url, method)) {
          return originalFetch.apply(this, arguments);
        }
        if (input instanceof Request) {
          try {
            const cloned = input.clone();
            const bodyText = await cloned.text();
            const next = injectCatalogIntoRequestBody(bodyText, currentPrompt);
            if (next.injected) {
              const request = new Request(input, { body: next.bodyText });
              return originalFetch.call(this, request);
            }
          } catch {}
          return originalFetch.apply(this, arguments);
        }
        if (init && typeof init.body === 'string') {
          const next = injectCatalogIntoRequestBody(init.body, currentPrompt);
          if (next.injected) {
            init.body = next.bodyText;
          }
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
      if (meta && currentPrompt && typeof body === 'string' && isChatGptConversationRequest(meta.url, meta.method)) {
        const next = injectCatalogIntoRequestBody(body, currentPrompt);
        if (next.injected) {
          body = next.bodyText;
        }
      }
      return originalSend.call(this, body);
    };
  })();`;
}
