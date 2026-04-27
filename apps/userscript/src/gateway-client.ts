import { TOKEN_HEADER, getExecuteResponseCompat, type ExecuteResponse, type ToolCallCompatResponse, type ToolCallRequest, type ToolDescriptor } from '@cwmb/protocol';
import { state } from './state.js';

export interface GatewayHealthResponse {
  ok: boolean;
  version: string;
  platform: string;
  host: string;
  port: number;
  workspaceRoot: string;
  shell: string;
  trustedLocalMode?: boolean;
  autoExecuteLowRisk?: boolean;
  autoInsertResult?: boolean;
  autoSendResult?: boolean;
  maxToolRounds?: number;
}

export async function health(): Promise<GatewayHealthResponse> {
  return gmJson('GET', `${state.baseUrl}/health`) as Promise<GatewayHealthResponse>;
}

export async function listTools(): Promise<ToolDescriptor[]> {
  const response = await gmJson('GET', `${state.baseUrl}/tools`, undefined, { [TOKEN_HEADER]: state.token }) as { tools?: ToolDescriptor[] };
  return Array.isArray(response.tools) ? response.tools : [];
}

export async function callTool(req: ToolCallRequest): Promise<Extract<ToolCallCompatResponse, { ok: true }>> {
  const response = await gmJson('POST', `${state.baseUrl}/call-tool`, req, { [TOKEN_HEADER]: state.token }) as ToolCallCompatResponse;
  const executeCompat = requireExecuteCompat(response);
  if (isToolFailure(response)) {
    const error = new Error(response.error.message);
    Object.assign(error, {
      code: response.error.code,
      details: response.error.details,
      execute: executeCompat
    });
    throw error;
  }

  return {
    ...response,
    execute: executeCompat
  };
}

function gmJson(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method,
      url,
      data: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
      timeout: 15_000,
      onload: (response) => {
        try {
          const payload = response.responseText ? JSON.parse(response.responseText) : null;
          if (response.status >= 400) {
            reject(toGatewayError(response.status, payload));
            return;
          }
          resolve(payload);
        } catch (err) {
          reject(err);
        }
      },
      onerror: reject,
      ontimeout: () => reject(new Error('Gateway request timed out'))
    });
  });
}

function toGatewayError(status: number, payload: unknown): Error {
  const code = getPayloadField(payload, 'code') ?? getNestedPayloadField(payload, 'error', 'code') ?? `HTTP_${status}`;
  const message = getPayloadField(payload, 'message') ?? getNestedPayloadField(payload, 'error', 'message') ?? `Gateway request failed with status ${status}`;
  const details = getPayloadField(payload, 'details') ?? getNestedPayloadField(payload, 'error', 'details');
  const error = new Error(message);
  Object.assign(error, { code, details, status });
  return error;
}

function requireExecuteCompat(payload: unknown): ExecuteResponse {
  const executeCompat = getExecuteResponseCompat(payload);
  if (executeCompat) {
    return executeCompat;
  }

  const error = new Error('Gateway /call-tool response is missing valid execute metadata');
  Object.assign(error, { code: 'INVALID_GATEWAY_RESPONSE' });
  throw error;
}

function getPayloadField(payload: unknown, key: string): string | undefined {
  if (!payload || typeof payload !== 'object' || !(key in payload)) {
    return undefined;
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function getNestedPayloadField(payload: unknown, parentKey: string, childKey: string): string | undefined {
  if (!payload || typeof payload !== 'object' || !(parentKey in payload)) {
    return undefined;
  }

  const parent = (payload as Record<string, unknown>)[parentKey];
  if (!parent || typeof parent !== 'object' || !(childKey in parent)) {
    return undefined;
  }

  const value = (parent as Record<string, unknown>)[childKey];
  return typeof value === 'string' ? value : undefined;
}

function isToolFailure(response: ToolCallCompatResponse): response is Extract<ToolCallCompatResponse, { ok: false }> {
  return response.ok === false;
}
