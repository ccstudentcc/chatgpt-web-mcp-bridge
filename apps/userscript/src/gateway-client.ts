import { TOKEN_HEADER, type ToolCallRequest, type ToolCallResponse } from '@cwmb/protocol';
import { state } from './state.js';

export async function health(): Promise<unknown> {
  return gmJson('GET', `${state.baseUrl}/health`);
}

export async function callTool(req: ToolCallRequest): Promise<ToolCallResponse> {
  return gmJson('POST', `${state.baseUrl}/call-tool`, req, { [TOKEN_HEADER]: state.token }) as Promise<ToolCallResponse>;
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
          resolve(response.responseText ? JSON.parse(response.responseText) : null);
        } catch (err) {
          reject(err);
        }
      },
      onerror: reject,
      ontimeout: () => reject(new Error('Gateway request timed out'))
    });
  });
}
