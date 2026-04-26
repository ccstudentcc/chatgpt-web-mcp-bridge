import type { ToolDescriptor } from '@cwmb/protocol';
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
  | 'sent'
  | 'batch_sent'
  | 'failed';

export interface ExecutionProgress {
  current: number;
  total: number;
  tool: string;
}

export interface StoredBatch {
  blocks: ParsedMcpBlock[];
  batchId: string;
  messageId: string;
}

export interface BridgeState {
  status: BridgeStatus;
  token: string;
  baseUrl: string;
  trustedLocalMode: boolean;
  autoExecuteEnabled: boolean;
  autoInsertResult: boolean;
  autoSendResult: boolean;
  tools: ToolDescriptor[];
  toolCatalogLoaded: boolean;
  pending: ParsedMcpBlock[];
  pendingBatchId?: string;
  pendingMessageId?: string;
  executedCallIds: Set<string>;
  executedBatchIds: Set<string>;
  retryableBatch?: StoredBatch;
  progress?: ExecutionProgress;
  lastResult?: string;
  lastError?: string;
}

export const state: BridgeState = {
  status: 'idle',
  token: GM_getValue('cwmb_token', ''),
  baseUrl: GM_getValue('cwmb_base_url', 'http://127.0.0.1:8024'),
  trustedLocalMode: true,
  autoExecuteEnabled: true,
  autoInsertResult: true,
  autoSendResult: true,
  tools: [],
  toolCatalogLoaded: false,
  pending: [],
  executedCallIds: new Set<string>(),
  executedBatchIds: new Set<string>()
};

export function saveToken(token: string): void {
  state.token = token;
  GM_setValue('cwmb_token', token);
}

export function saveBaseUrl(baseUrl: string): void {
  state.baseUrl = baseUrl;
  GM_setValue('cwmb_base_url', baseUrl);
}

export function applyAutomationSettings(settings: {
  trustedLocalMode?: boolean;
  autoExecuteLowRisk?: boolean;
  autoInsertResult?: boolean;
  autoSendResult?: boolean;
}): void {
  if (typeof settings.trustedLocalMode === 'boolean') {
    state.trustedLocalMode = settings.trustedLocalMode;
  }
  if (typeof settings.autoExecuteLowRisk === 'boolean') {
    state.autoExecuteEnabled = settings.autoExecuteLowRisk;
  }
  if (typeof settings.autoInsertResult === 'boolean') {
    state.autoInsertResult = settings.autoInsertResult;
  }
  if (typeof settings.autoSendResult === 'boolean') {
    state.autoSendResult = settings.autoSendResult;
  }
}
