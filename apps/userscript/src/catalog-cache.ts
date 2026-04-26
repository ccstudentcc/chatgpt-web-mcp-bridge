import type { ToolDescriptor } from '@cwmb/protocol';

const TOOL_CATALOG_CACHE_KEY = 'cwmb_tool_catalog_cache';

export function readStoredToolCatalog(): ToolDescriptor[] {
  const raw = GM_getValue(TOOL_CATALOG_CACHE_KEY, '');
  if (typeof raw !== 'string' || raw.trim() === '') {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isToolDescriptor);
  } catch {
    return [];
  }
}

export function writeStoredToolCatalog(tools: ToolDescriptor[]): void {
  GM_setValue(TOOL_CATALOG_CACHE_KEY, JSON.stringify(tools));
}

function isToolDescriptor(value: unknown): value is ToolDescriptor {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.name === 'string'
    && typeof record.title === 'string'
    && typeof record.description === 'string'
    && typeof record.risk === 'string'
    && typeof record.requiresConfirmation === 'boolean'
    && typeof record.enabled === 'boolean'
    && record.exampleArgs !== undefined
    && record.exampleArgs !== null
    && typeof record.exampleArgs === 'object';
}
