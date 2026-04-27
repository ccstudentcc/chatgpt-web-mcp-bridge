import type { CatalogSource, GatewayHealthContract, GatewayRuntimeSnapshot } from '@cwmb/protocol';
import type { ParsedMcpBlock } from './parser.js';
import type { DeliveryRecoveryNotice } from './result-delivery.js';
import {
  getGatewayCatalogTools,
  hasLiveGatewayCatalog,
  withGatewayCatalog,
  withGatewayHealth,
  withoutGatewayCatalog
} from './runtime-snapshot.js';
import {
  cycleRequestInjectionMode as getNextRequestInjectionMode,
  normalizeRequestInjectionMode,
  type RequestInjectionMode
} from './request-injection-state.js';

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
  | 'invalid_mcp_turn'
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

export interface ActivityLogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export interface PanelPosition {
  left: number;
  top: number;
}

export interface BridgeState {
  status: BridgeStatus;
  token: string;
  baseUrl: string;
  trustedLocalMode: boolean;
  maxToolRounds: number;
  gatewayAutoExecuteDefault: boolean;
  gatewayAutoInsertDefault: boolean;
  gatewayAutoSendDefault: boolean;
  autoExecuteEnabled: boolean;
  autoInsertResult: boolean;
  autoSendResult: boolean;
  continueBatchOnError: boolean;
  panelCollapsed: boolean;
  panelPosition?: PanelPosition;
  gatewayRuntime?: GatewayRuntimeSnapshot;
  pending: ParsedMcpBlock[];
  pendingBatchId?: string;
  pendingMessageId?: string;
  pendingRequestId?: string;
  lastInvalidMcpMessageId?: string;
  executedCallIds: Set<string>;
  executedBatchIds: Set<string>;
  retryableBatch?: StoredBatch;
  autoRoundRequestId?: string;
  autoRoundCount: number;
  progress?: ExecutionProgress;
  lastResult?: string;
  lastError?: string;
  lastDeliveryRecovery?: DeliveryRecoveryNotice;
  logs: ActivityLogEntry[];
  requestInjectionMode: RequestInjectionMode;
}

const autoExecuteStored = GM_getValue('cwmb_auto_execute', 'inherit');
const autoInsertStored = GM_getValue('cwmb_auto_insert', 'inherit');
const autoSendStored = GM_getValue('cwmb_auto_send', 'inherit');
const panelLeftStored = parseStoredNumber(GM_getValue('cwmb_panel_left', ''));
const panelTopStored = parseStoredNumber(GM_getValue('cwmb_panel_top', ''));

function readStoredToggle(stored: string, fallback: boolean): boolean {
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return fallback;
}

function parseStoredNumber(stored: string): number | undefined {
  if (!stored) return undefined;
  const parsed = Number(stored);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const state: BridgeState = {
  status: 'idle',
  token: GM_getValue('cwmb_token', ''),
  baseUrl: GM_getValue('cwmb_base_url', 'http://127.0.0.1:8024'),
  trustedLocalMode: true,
  maxToolRounds: 3,
  gatewayAutoExecuteDefault: true,
  gatewayAutoInsertDefault: true,
  gatewayAutoSendDefault: true,
  autoExecuteEnabled: readStoredToggle(autoExecuteStored, true),
  autoInsertResult: readStoredToggle(autoInsertStored, true),
  autoSendResult: readStoredToggle(autoSendStored, true),
  continueBatchOnError: GM_getValue('cwmb_continue_batch_on_error', 'false') === 'true',
  panelCollapsed: GM_getValue('cwmb_panel_collapsed', 'false') === 'true',
  panelPosition: typeof panelLeftStored === 'number' && typeof panelTopStored === 'number'
    ? { left: panelLeftStored, top: panelTopStored }
    : undefined,
  pending: [],
  autoRoundCount: 0,
  executedCallIds: new Set<string>(),
  executedBatchIds: new Set<string>(),
  logs: [],
  requestInjectionMode: normalizeRequestInjectionMode(GM_getValue('cwmb_request_injection_mode', 'synthetic_system'))
};

export function saveToken(token: string): void {
  state.token = token;
  GM_setValue('cwmb_token', token);
}

export function saveBaseUrl(baseUrl: string): void {
  state.baseUrl = baseUrl;
  GM_setValue('cwmb_base_url', baseUrl);
}

export function hasLiveCatalog(runtime = state.gatewayRuntime): boolean {
  return hasLiveGatewayCatalog(runtime);
}

export function getCatalogTools() {
  return getGatewayCatalogTools(state.gatewayRuntime);
}

export function setGatewayHealth(health: GatewayHealthContract): void {
  state.gatewayRuntime = withGatewayHealth(state.gatewayRuntime, health);
  applyAutomationSettings(health);
}

export function setGatewayCatalog(catalog: GatewayRuntimeSnapshot['catalog'], source: CatalogSource): void {
  if (!catalog) {
    return;
  }

  state.gatewayRuntime = withGatewayCatalog(state.gatewayRuntime, catalog, source);
}

export function clearGatewayCatalog(): void {
  state.gatewayRuntime = withoutGatewayCatalog(state.gatewayRuntime);
}

export function clearGatewayRuntime(): void {
  state.gatewayRuntime = undefined;
}

export function applyAutomationSettings(settings: {
  trustedLocalMode?: boolean;
  autoExecuteLowRisk?: boolean;
  autoInsertResult?: boolean;
  autoSendResult?: boolean;
  maxToolRounds?: number;
}): void {
  if (typeof settings.trustedLocalMode === 'boolean') {
    state.trustedLocalMode = settings.trustedLocalMode;
  }
  if (typeof settings.maxToolRounds === 'number') {
    state.maxToolRounds = settings.maxToolRounds;
  }
  if (typeof settings.autoExecuteLowRisk === 'boolean') {
    state.gatewayAutoExecuteDefault = settings.autoExecuteLowRisk;
    if (GM_getValue('cwmb_auto_execute', 'inherit') === 'inherit') {
      state.autoExecuteEnabled = settings.autoExecuteLowRisk;
    }
  }
  if (typeof settings.autoInsertResult === 'boolean') {
    state.gatewayAutoInsertDefault = settings.autoInsertResult;
    if (GM_getValue('cwmb_auto_insert', 'inherit') === 'inherit') {
      state.autoInsertResult = settings.autoInsertResult;
    }
  }
  if (typeof settings.autoSendResult === 'boolean') {
    state.gatewayAutoSendDefault = settings.autoSendResult;
    if (GM_getValue('cwmb_auto_send', 'inherit') === 'inherit') {
      state.autoSendResult = settings.autoSendResult;
    }
  }
}

export function toggleAutoExecute(): void {
  state.autoExecuteEnabled = !state.autoExecuteEnabled;
  GM_setValue('cwmb_auto_execute', String(state.autoExecuteEnabled));
}

export function toggleAutoInsert(): void {
  state.autoInsertResult = !state.autoInsertResult;
  GM_setValue('cwmb_auto_insert', String(state.autoInsertResult));
}

export function toggleAutoSend(): void {
  state.autoSendResult = !state.autoSendResult;
  GM_setValue('cwmb_auto_send', String(state.autoSendResult));
}

export function toggleContinueBatchOnError(): void {
  state.continueBatchOnError = !state.continueBatchOnError;
  GM_setValue('cwmb_continue_batch_on_error', String(state.continueBatchOnError));
}

export function cycleRequestInjectionMode(): void {
  state.requestInjectionMode = getNextRequestInjectionMode(state.requestInjectionMode);
  GM_setValue('cwmb_request_injection_mode', state.requestInjectionMode);
}

export function togglePanelCollapsed(): void {
  state.panelCollapsed = !state.panelCollapsed;
  GM_setValue('cwmb_panel_collapsed', String(state.panelCollapsed));
}

export function savePanelPosition(position: PanelPosition): void {
  state.panelPosition = position;
  GM_setValue('cwmb_panel_left', String(position.left));
  GM_setValue('cwmb_panel_top', String(position.top));
}

export function addLogEntry(level: ActivityLogEntry['level'], message: string): void {
  state.logs = [
    ...state.logs,
    {
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      level,
      message
    }
  ].slice(-40);
}
