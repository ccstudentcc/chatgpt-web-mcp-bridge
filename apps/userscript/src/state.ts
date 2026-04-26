import type { ParsedMcpBlock } from './parser.js';

export type BridgeStatus = 'disconnected' | 'unauthorized' | 'idle' | 'detected' | 'executing' | 'result_ready' | 'inserted' | 'failed';

export interface BridgeState {
  status: BridgeStatus;
  token: string;
  baseUrl: string;
  pending: ParsedMcpBlock[];
  executedCallIds: Set<string>;
  lastResult?: string;
  lastError?: string;
}

export const state: BridgeState = {
  status: 'idle',
  token: GM_getValue('cwmb_token', ''),
  baseUrl: GM_getValue('cwmb_base_url', 'http://127.0.0.1:8024'),
  pending: [],
  executedCallIds: new Set<string>()
};

export function saveToken(token: string): void {
  state.token = token;
  GM_setValue('cwmb_token', token);
}
