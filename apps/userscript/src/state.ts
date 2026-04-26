import type { ParsedMcpBlock } from './parser.js';

export type BridgeStatus =
  | 'disconnected'
  | 'unauthorized'
  | 'idle'
  | 'detected'
  | 'detected_batch'
  | 'executing'
  | 'batch_executing'
  | 'batch_stopped_on_failure'
  | 'result_ready'
  | 'batch_result_ready'
  | 'inserted'
  | 'batch_inserted'
  | 'failed';

export interface ExecutionProgress {
  current: number;
  total: number;
  tool: string;
}

export interface BridgeState {
  status: BridgeStatus;
  token: string;
  baseUrl: string;
  pending: ParsedMcpBlock[];
  pendingBatchId?: string;
  pendingMessageId?: string;
  executedCallIds: Set<string>;
  executedBatchIds: Set<string>;
  progress?: ExecutionProgress;
  lastResult?: string;
  lastError?: string;
}

export const state: BridgeState = {
  status: 'idle',
  token: GM_getValue('cwmb_token', ''),
  baseUrl: GM_getValue('cwmb_base_url', 'http://127.0.0.1:8024'),
  pending: [],
  executedCallIds: new Set<string>(),
  executedBatchIds: new Set<string>()
};

export function saveToken(token: string): void {
  state.token = token;
  GM_setValue('cwmb_token', token);
}
