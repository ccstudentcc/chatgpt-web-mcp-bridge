import { PAGE_ORIGIN_HEADER } from '@cwmb/tool-contracts';

const CHATGPT_PAGE_ORIGINS = new Set([
  'https://chatgpt.com',
  'https://chat.openai.com'
]);

export function assertAllowedOrigin(headers: Record<string, string | string[] | undefined>): void {
  const origin = readHeader(headers, 'origin');
  if (!origin) {
    return;
  }

  if (CHATGPT_PAGE_ORIGINS.has(origin)) {
    return;
  }

  if (isExtensionOrigin(origin) && CHATGPT_PAGE_ORIGINS.has(readHeader(headers, PAGE_ORIGIN_HEADER.toLowerCase()) ?? '')) {
    return;
  }

  throw Object.assign(new Error('Origin is not allowed.'), { code: 'ORIGIN_NOT_ALLOWED' });
}

function isExtensionOrigin(origin: string): boolean {
  return origin.startsWith('chrome-extension://');
}

function readHeader(headers: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = headers[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
