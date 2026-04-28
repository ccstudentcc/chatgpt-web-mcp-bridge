import type { CatalogSource } from '@cwmb/protocol';

export type RequestHookStatus = 'injected' | 'missing_prompt' | 'matched_without_injection';
export type RequestInjectionMode = 'prepend_user' | 'synthetic_system';

export interface RequestPromptSnapshot {
  prompt: string;
  mode: RequestInjectionMode;
  source?: CatalogSource;
  catalogVersion?: string;
}

export interface RequestHookStatusDetail {
  status: RequestHookStatus;
  transport?: string;
  source?: CatalogSource;
  catalogVersion?: string;
}

export function normalizeRequestInjectionMode(value: string | null | undefined): RequestInjectionMode {
  return value === 'prepend_user' ? 'prepend_user' : 'synthetic_system';
}

export function cycleRequestInjectionMode(mode: RequestInjectionMode): RequestInjectionMode {
  return mode === 'synthetic_system' ? 'prepend_user' : 'synthetic_system';
}

export function createEmptyRequestPromptSnapshot(mode: RequestInjectionMode): RequestPromptSnapshot {
  return {
    prompt: '',
    mode
  };
}

export function describeRequestHookStatus(detail: RequestHookStatusDetail): {
  level: 'success' | 'warn';
  message: string;
} {
  const transport = detail.transport ?? 'request';
  const catalogLabel = formatCatalogLabel(detail.source, detail.catalogVersion);
  if (detail.status === 'injected') {
    return {
      level: 'success',
      message: `Request hook injected ${catalogLabel} via ${transport} conversation request.`
    };
  }

  if (detail.status === 'missing_prompt') {
    return {
      level: 'warn',
      message: `Conversation request reached the page hook before any MCP catalog prompt was ready (${transport}).`
    };
  }

  return {
    level: 'warn',
    message: `Conversation request matched ChatGPT while using ${catalogLabel}, but the body shape was not patched (${transport}).`
  };
}

function formatCatalogLabel(source?: CatalogSource, catalogVersion?: string): string {
  const sourceLabel = source === 'cache'
    ? 'cached bootstrap catalog'
    : source === 'live'
      ? 'live /tools catalog'
      : 'the current MCP catalog prompt';
  return catalogVersion ? `${sourceLabel} [${catalogVersion}]` : sourceLabel;
}
