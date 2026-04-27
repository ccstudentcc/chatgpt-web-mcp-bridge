export type RequestHookStatus = 'injected' | 'missing_prompt' | 'matched_without_injection';
export type RequestInjectionMode = 'prepend_user' | 'synthetic_system';

export interface RequestHookStatusDetail {
  status: RequestHookStatus;
  transport?: string;
}

export function normalizeRequestInjectionMode(value: string | null | undefined): RequestInjectionMode {
  return value === 'prepend_user' ? 'prepend_user' : 'synthetic_system';
}

export function cycleRequestInjectionMode(mode: RequestInjectionMode): RequestInjectionMode {
  return mode === 'synthetic_system' ? 'prepend_user' : 'synthetic_system';
}

export function describeRequestHookStatus(detail: RequestHookStatusDetail): {
  level: 'success' | 'warn';
  message: string;
} {
  const transport = detail.transport ?? 'request';
  if (detail.status === 'injected') {
    return {
      level: 'success',
      message: `Request hook injected MCP catalog via ${transport} conversation request.`
    };
  }

  if (detail.status === 'missing_prompt') {
    return {
      level: 'warn',
      message: `Conversation request reached the page hook before the MCP catalog prompt was ready (${transport}).`
    };
  }

  return {
    level: 'warn',
    message: `Conversation request matched ChatGPT, but the body shape was not patched (${transport}).`
  };
}
