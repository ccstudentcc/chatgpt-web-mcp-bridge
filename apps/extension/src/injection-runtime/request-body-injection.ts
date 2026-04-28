import type { RequestInjectionMode } from './request-injection-state.js';

export interface RequestBodyInjectionResult {
  bodyText: string;
  injected: boolean;
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

export function injectCatalogIntoPayload(payload: Record<string, unknown>, prompt: string, mode: RequestInjectionMode): boolean {
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

export function tryInjectIntoMessageList(messages: unknown[], prompt: string): boolean {
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

export function tryInjectSyntheticSystemMessage(messages: unknown[], prompt: string): 'inserted' | 'present' | 'failed' {
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

export function messageContainsPrompt(message: unknown, prompt: string, promptMarker: string): boolean {
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

export function createSyntheticSystemMessage(reference: unknown, prompt: string): Record<string, unknown> {
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

export function createSyntheticContent(content: unknown, prompt: string): unknown {
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

export function isUserMessage(message: unknown): boolean {
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

export function tryInjectIntoMessage(message: unknown, prompt: string): boolean {
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

export function tryInjectIntoMessageContent(content: Record<string, unknown>, prompt: string): boolean {
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

export function tryInjectIntoContentParts(content: Record<string, unknown>, prompt: string): boolean {
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

export function tryInjectIntoTypedContent(contentParts: unknown[], prompt: string): boolean {
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

export function tryInjectIntoRootFields(payload: Record<string, unknown>, prompt: string): boolean {
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

export function prependPrompt(target: string, prompt: string): { value: string; modified: boolean } {
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

export function extractPromptMarker(prompt: string): string {
  return prompt.split('\n', 1)[0]?.trim() ?? '';
}
