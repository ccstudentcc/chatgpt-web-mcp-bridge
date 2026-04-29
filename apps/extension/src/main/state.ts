import type { CatalogSource, GatewayHealthContract, GatewayRuntimeSnapshot } from '@cwmb/tool-contracts';
import type { ParsedMcpBlock } from './parser.js';
import type { DeliveryRecoveryNotice } from '../result-delivery/index.js';
import { normalizeChatGptConversationPath } from '../chatgpt-adapter/index.js';
import { matchesRecoveredComposerState } from '../result-delivery/index.js';
import {
  getGatewayCatalogTools,
  hasLiveGatewayCatalog,
  withGatewayCatalog,
  withGatewayHealth,
  withoutGatewayCatalog
} from '../operator-panel/index.js';
import type { RequestHookStatus, RequestInjectionMode } from '../injection-runtime/index.js';
import {
  DEFAULT_EXTENSION_SETTINGS,
  type BooleanSettingOverride,
  type ExtensionSettingsSnapshot,
  type WorkSurfaceMode
} from '../settings/contracts.js';

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

export interface RequestPromptObserver {
  source: CatalogSource;
  catalogVersion?: string;
}

export interface RequestHookObserver {
  status: RequestHookStatus;
  transport?: string;
  source?: CatalogSource;
  catalogVersion?: string;
}

export interface BridgeState {
  status: BridgeStatus;
  token: string;
  baseUrl: string;
  autoExecutePreference: BooleanSettingOverride;
  autoInsertPreference: BooleanSettingOverride;
  autoSendPreference: BooleanSettingOverride;
  trustedLocalMode: boolean;
  maxToolRounds: number;
  gatewayAutoExecuteDefault: boolean;
  gatewayAutoInsertDefault: boolean;
  gatewayAutoSendDefault: boolean;
  autoExecuteEnabled: boolean;
  autoInsertResult: boolean;
  autoSendResult: boolean;
  continueBatchOnError: boolean;
  workSurfaceMode: WorkSurfaceMode;
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
  preservedDraft?: string;
  recoveredComposerSnapshot?: string;
  lastError?: string;
  lastDeliveryRecovery?: DeliveryRecoveryNotice;
  logs: ActivityLogEntry[];
  requestInjectionMode: RequestInjectionMode;
  requestPrompt?: RequestPromptObserver;
  lastRequestHook?: RequestHookObserver;
}

type PersistedUndeliveredResultStatus = Extract<
  BridgeStatus,
  'failed' | 'result_ready' | 'batch_result_ready' | 'batch_stopped_on_failure' | 'inserted' | 'batch_inserted'
>;

interface PersistedUndeliveredResultSession {
  conversationPath: string;
  status: PersistedUndeliveredResultStatus;
  lastResult: string;
  composerSnapshot?: string;
  preservedDraft?: string;
  lastError?: string;
  lastDeliveryRecovery?: DeliveryRecoveryNotice;
  executedCallIds: string[];
  executedBatchIds: string[];
  retryableBatch?: StoredBatch;
}

const UNDELIVERED_RESULT_SESSION_KEY = 'cwmb_undelivered_result_session';

const panelLeftStored = parseStoredNumber(GM_getValue('cwmb_panel_left', ''));
const panelTopStored = parseStoredNumber(GM_getValue('cwmb_panel_top', ''));

function parseStoredNumber(stored: string): number | undefined {
  if (!stored) return undefined;
  const parsed = Number(stored);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const state: BridgeState = {
  status: 'idle',
  token: DEFAULT_EXTENSION_SETTINGS.token,
  baseUrl: DEFAULT_EXTENSION_SETTINGS.baseUrl,
  autoExecutePreference: DEFAULT_EXTENSION_SETTINGS.autoExecute,
  autoInsertPreference: DEFAULT_EXTENSION_SETTINGS.autoInsert,
  autoSendPreference: DEFAULT_EXTENSION_SETTINGS.autoSend,
  trustedLocalMode: true,
  maxToolRounds: 3,
  gatewayAutoExecuteDefault: true,
  gatewayAutoInsertDefault: true,
  gatewayAutoSendDefault: true,
  autoExecuteEnabled: true,
  autoInsertResult: true,
  autoSendResult: true,
  continueBatchOnError: DEFAULT_EXTENSION_SETTINGS.continueBatchOnError,
  workSurfaceMode: DEFAULT_EXTENSION_SETTINGS.workSurfaceMode,
  panelCollapsed: GM_getValue('cwmb_panel_collapsed', 'false') === 'true',
  panelPosition: typeof panelLeftStored === 'number' && typeof panelTopStored === 'number'
    ? { left: panelLeftStored, top: panelTopStored }
    : undefined,
  pending: [],
  autoRoundCount: 0,
  executedCallIds: new Set<string>(),
  executedBatchIds: new Set<string>(),
  logs: [],
  requestInjectionMode: DEFAULT_EXTENSION_SETTINGS.requestInjectionMode,
  recoveredComposerSnapshot: undefined
};

export function applyExtensionSettings(settings: ExtensionSettingsSnapshot): void {
  state.token = settings.token;
  state.baseUrl = settings.baseUrl;
  state.autoExecutePreference = settings.autoExecute;
  state.autoInsertPreference = settings.autoInsert;
  state.autoSendPreference = settings.autoSend;
  state.continueBatchOnError = settings.continueBatchOnError;
  state.requestInjectionMode = settings.requestInjectionMode;
  state.workSurfaceMode = settings.workSurfaceMode;
  state.autoExecuteEnabled = resolveBooleanPreference(settings.autoExecute, state.gatewayAutoExecuteDefault);
  state.autoInsertResult = resolveBooleanPreference(settings.autoInsert, state.gatewayAutoInsertDefault);
  state.autoSendResult = resolveBooleanPreference(settings.autoSend, state.gatewayAutoSendDefault);
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

function resolveBooleanPreference(value: BooleanSettingOverride, fallback: boolean): boolean {
  return value === 'inherit' ? fallback : value;
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
    if (state.autoExecutePreference === 'inherit') {
      state.autoExecuteEnabled = settings.autoExecuteLowRisk;
    }
  }
  if (typeof settings.autoInsertResult === 'boolean') {
    state.gatewayAutoInsertDefault = settings.autoInsertResult;
    if (state.autoInsertPreference === 'inherit') {
      state.autoInsertResult = settings.autoInsertResult;
    }
  }
  if (typeof settings.autoSendResult === 'boolean') {
    state.gatewayAutoSendDefault = settings.autoSendResult;
    if (state.autoSendPreference === 'inherit') {
      state.autoSendResult = settings.autoSendResult;
    }
  }
}

export function togglePanelCollapsed(): void {
  state.panelCollapsed = !state.panelCollapsed;
  GM_setValue('cwmb_panel_collapsed', String(state.panelCollapsed));
}

export function setRequestPromptObserver(observer: RequestPromptObserver | undefined): void {
  state.requestPrompt = observer;
}

export function clearRequestPromptObserver(): void {
  state.requestPrompt = undefined;
}

export function setLastRequestHookObserver(observer: RequestHookObserver): void {
  state.lastRequestHook = observer;
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

export function syncPersistedUndeliveredResultSession({
  conversationPath,
  currentComposerText
}: {
  conversationPath: string;
  currentComposerText?: string;
}): void {
  if (!shouldPersistUndeliveredResult(state.status) || !state.lastResult) {
    GM_setValue(UNDELIVERED_RESULT_SESSION_KEY, '');
    return;
  }

  const normalizedPath = normalizeChatGptConversationPath(conversationPath);
  if (!normalizedPath) {
    GM_setValue(UNDELIVERED_RESULT_SESSION_KEY, '');
    return;
  }

  const persisted: PersistedUndeliveredResultSession = {
    conversationPath: normalizedPath,
    status: state.status,
    lastResult: state.lastResult,
    composerSnapshot: shouldPersistComposerSnapshot(state.status, currentComposerText)
      ? currentComposerText
      : undefined,
    preservedDraft: state.preservedDraft,
    lastError: state.lastError,
    lastDeliveryRecovery: state.lastDeliveryRecovery,
    executedCallIds: [...state.executedCallIds],
    executedBatchIds: [...state.executedBatchIds],
    retryableBatch: state.retryableBatch
  };
  GM_setValue(UNDELIVERED_RESULT_SESSION_KEY, JSON.stringify(persisted));
}

export function restorePersistedUndeliveredResultSession({
  conversationPath,
  currentComposerText,
  clearOnMismatch = true
}: {
  conversationPath: string;
  currentComposerText: string;
  clearOnMismatch?: boolean;
}): boolean {
  const restored = readPersistedUndeliveredResultSession(conversationPath);
  if (!restored) {
    return false;
  }

  if (!matchesPersistedComposerState(restored, currentComposerText)) {
    if (clearOnMismatch) {
      GM_setValue(UNDELIVERED_RESULT_SESSION_KEY, '');
    }
    return false;
  }

  state.status = restored.status;
  state.lastResult = restored.lastResult;
  state.preservedDraft = restored.preservedDraft;
  state.recoveredComposerSnapshot = restored.composerSnapshot;
  state.lastError = restored.lastError;
  state.lastDeliveryRecovery = restored.lastDeliveryRecovery;
  state.retryableBatch = restored.retryableBatch;
  state.executedCallIds = new Set(restored.executedCallIds);
  state.executedBatchIds = new Set(restored.executedBatchIds);
  return true;
}

export function hasPersistedUndeliveredResultSession(conversationPath: string): boolean {
  return readPersistedUndeliveredResultSession(conversationPath) !== null;
}

export function matchesPersistedUndeliveredResultSession({
  conversationPath,
  currentComposerText
}: {
  conversationPath: string;
  currentComposerText: string;
}): boolean {
  const restored = readPersistedUndeliveredResultSession(conversationPath);
  if (!restored) {
    return false;
  }

  return matchesPersistedComposerState(restored, currentComposerText);
}

function shouldPersistUndeliveredResult(status: BridgeStatus): status is PersistedUndeliveredResultStatus {
  return status === 'failed'
    || status === 'result_ready'
    || status === 'batch_result_ready'
    || status === 'batch_stopped_on_failure'
    || status === 'inserted'
    || status === 'batch_inserted';
}

function readPersistedUndeliveredResultSession(conversationPath: string): PersistedUndeliveredResultSession | null {
  const raw = GM_getValue(UNDELIVERED_RESULT_SESSION_KEY, '');
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedUndeliveredResultSession>;
    const normalizedPath = normalizeChatGptConversationPath(conversationPath);
    const parsedStatus = parsed.status;
    if (
      !parsed
      || typeof parsed.conversationPath !== 'string'
      || normalizeChatGptConversationPath(parsed.conversationPath) !== normalizedPath
      || typeof parsed.lastResult !== 'string'
      || !Array.isArray(parsed.executedCallIds)
      || !Array.isArray(parsed.executedBatchIds)
      || !shouldPersistUndeliveredResult(parsedStatus as BridgeStatus)
    ) {
      return null;
    }

    const status = parsedStatus as PersistedUndeliveredResultStatus;

    return {
      conversationPath: parsed.conversationPath,
      status,
      lastResult: parsed.lastResult,
      composerSnapshot: typeof parsed.composerSnapshot === 'string' ? parsed.composerSnapshot : undefined,
      preservedDraft: typeof parsed.preservedDraft === 'string' ? parsed.preservedDraft : undefined,
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : undefined,
      lastDeliveryRecovery: isDeliveryRecoveryNotice(parsed.lastDeliveryRecovery) ? parsed.lastDeliveryRecovery : undefined,
      executedCallIds: parsed.executedCallIds.filter((item): item is string => typeof item === 'string'),
      executedBatchIds: parsed.executedBatchIds.filter((item): item is string => typeof item === 'string'),
      retryableBatch: isStoredBatch(parsed.retryableBatch) ? parsed.retryableBatch : undefined
    };
  } catch {
    return null;
  }
}

function isDeliveryRecoveryNotice(value: unknown): value is DeliveryRecoveryNotice {
  return value !== null
    && typeof value === 'object'
    && 'kind' in value
    && 'message' in value
    && typeof (value as { kind: unknown }).kind === 'string'
    && typeof (value as { message: unknown }).message === 'string';
}

function isStoredBatch(value: unknown): value is StoredBatch {
  return value !== null
    && typeof value === 'object'
    && 'batchId' in value
    && 'messageId' in value
    && 'blocks' in value
    && typeof (value as { batchId: unknown }).batchId === 'string'
    && typeof (value as { messageId: unknown }).messageId === 'string'
    && Array.isArray((value as { blocks: unknown }).blocks);
}

function normalizePersistedText(value: string): string {
  return value.replace(/\u00a0/g, ' ').trim();
}

function shouldPersistComposerSnapshot(
  status: PersistedUndeliveredResultStatus,
  currentComposerText?: string
): currentComposerText is string {
  return (status === 'inserted' || status === 'batch_inserted')
    && typeof currentComposerText === 'string'
    && normalizePersistedText(currentComposerText).length > 0;
}

function matchesPersistedComposerState(
  session: PersistedUndeliveredResultSession,
  currentComposerText: string
): boolean {
  return matchesRecoveredComposerState({
    currentText: currentComposerText,
    payload: session.lastResult,
    composerSnapshot: session.composerSnapshot
  });
}
