import { buildToolCatalogPrompt, createRequestPromptSnapshot, describeRequestPromptSync } from './catalog.js';
import { readStoredToolCatalog, writeStoredToolCatalog } from './catalog-cache.js';
import { assessPendingTools } from './capabilities.js';
import {
  createExecutionErrorEnvelopeFromLegacyResponse,
  createInlineToolResultEnvelopeFromLegacyResponse,
  createLegacyToolCallRequest,
  getExecuteResponseCompat,
  type CatalogContract,
  type CatalogSource,
  type BatchResultItem,
  type ToolCallFailure
} from '@cwmb/protocol';
import { createBatchId, executeBatch } from './batch.js';
import { callTool, health, listCatalog } from './gateway-client.js';
import { extractVisibleText, findLatestOpenAssistantMessage, findLatestUserMessage, onChatMutation } from './dom.js';
import { sha256Normalized } from './hash.js';
import { insertIntoChatInput, isChatInputSubmitting, readCurrentChatInputText, sendCurrentChatInput } from './inserter.js';
import { createEmptyRequestPromptSnapshot, describeRequestHookStatus } from './request-injection-state.js';
import {
  deriveBatchDeliveryOutcome,
  deliverResult,
  deriveDeliveryPanelState,
  deriveRecoveredDeliveryRuntimeState,
  formatBatchToolResult,
  formatToolResult,
  hasStartupRecoveryComposerText,
  isBatchReadyDeliveryStatus,
  restorePersistedUndeliveredResultSessionOnStartup,
  resolveDeliveredBridgeStatus,
  shouldKeepRecoveredDeliveryRetryWindow,
  type ReadyDeliveryStatus
} from './result-delivery.js';
import { canAutoRunForRequest, recordAutoRunForRequest, syncAutoRoundRequest } from './round-guard.js';
import { installPageRequestHook, syncRequestPrompt, type RequestHookStatus } from './request-hook.js';
import {
  clearPendingSelectionRuntime,
  consumeFirstPendingRuntime,
  createIgnoredPendingRuntimeUpdate,
  createAssistantTurnScanState,
  getPendingTurnRuntimeStatus,
  hasPendingTurnBatch,
  pollLatestAssistantTurnRuntime,
  resolveCurrentRequestIdentity
} from '../../extension/src/turn-runtime/index.js';
import { renderPanel, setUiHandlers } from './ui.js';
import {
  addLogEntry,
  clearGatewayCatalog,
  clearGatewayRuntime,
  getCatalogTools,
  hasPersistedUndeliveredResultSession,
  matchesPersistedUndeliveredResultSession,
  hasLiveCatalog,
  restorePersistedUndeliveredResultSession,
  setGatewayCatalog,
  setGatewayHealth,
  syncPersistedUndeliveredResultSession,
  type BridgeStatus,
  type StoredBatch,
  state,
  toggleAutoExecute,
  toggleAutoInsert,
  toggleAutoSend,
  toggleContinueBatchOnError,
  togglePanelCollapsed
} from './state.js';

installPageRequestHook();
installRequestHookDiagnostics();
bootstrapRequestPrompt();
void warmRequestPromptFromGateway();

let lastRequestHookStatusKey = '';
let lastRequestPromptSyncKey = '';
let requestHookConversationEventCount = 0;
let turnScanState = createAssistantTurnScanState();
const INVALID_TURN_GRACE_MS = 2_000;
const STARTUP_UNDELIVERED_RECOVERY_GRACE_MS = 2_500;
const RECOVERED_DELIVERY_RETRY_COOLDOWN_MS = 250;
let startupUndeliveredRecoveryDeadline = 0;
let recoveredDeliveryResumeInFlight = false;
let recoveredDeliveryRetryNotBefore = 0;

async function refreshGatewayStatus(): Promise<void> {
  try {
    const gatewayHealth = await health();
    setGatewayHealth(gatewayHealth);
    await refreshToolCatalog();
    if (state.status === 'disconnected' || state.status === 'unauthorized' || state.status === 'idle' || state.status === 'detected' || state.status === 'detected_batch') {
      state.status = getPendingTurnRuntimeStatus(state.pending.length, state.pendingBatchId);
      state.lastError = undefined;
    }
    addLogEntry('success', `Gateway synced: ${state.baseUrl}`);
  } catch (err) {
    const errorCode = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (errorCode === 'UNAUTHORIZED') {
      state.status = 'unauthorized';
      clearGatewayCatalog();
      lastRequestPromptSyncKey = '';
      syncRequestPrompt(createEmptyRequestPromptSnapshot(state.requestInjectionMode));
      state.lastError = err instanceof Error ? err.message : 'Gateway authorization failed.';
      addLogEntry('error', `Gateway unauthorized: ${state.lastError}`);
    } else {
      state.status = 'disconnected';
      clearGatewayRuntime();
      lastRequestPromptSyncKey = '';
      syncRequestPrompt(createEmptyRequestPromptSnapshot(state.requestInjectionMode));
      state.lastError = err instanceof Error ? err.message : 'Gateway disconnected';
      addLogEntry('error', `Gateway disconnected: ${state.lastError}`);
    }
  }
  renderPanel();
  syncUndeliveredResultSession();
  void maybeAutoRunPending();
}
async function scanLatestAssistantMessage(): Promise<void> {
  if (state.status === 'executing' || state.status === 'batch_executing') return;
  if (await shouldPauseTurnScanForStartupRecovery()) return;
  if (shouldDeferPendingDetectionForComposerDraft()) return;
  const detection = await pollLatestAssistantTurnRuntime({
    findLatestUserMessage,
    findLatestOpenAssistantMessage,
    extractVisibleText,
    conversationPath: window.location.pathname,
    state: turnScanState,
    executedCallIds: state.executedCallIds,
    executedBatchIds: state.executedBatchIds,
    currentPendingCallIds: state.pending.map((item) => item.callId),
    currentPendingBatchId: state.pendingBatchId,
    currentStatus: state.status,
    hasRetryableBatch: Boolean(state.retryableBatch),
    lastInvalidMcpMessageId: state.lastInvalidMcpMessageId,
    lastError: state.lastError,
    createCallId: (messageId, raw) => sha256Normalized(`${messageId}\n\n${raw}`),
    createBatchId,
    now: Date.now(),
    invalidGraceMs: INVALID_TURN_GRACE_MS
  });
  turnScanState = detection.nextState;

  if (detection.status === 'clear') {
    if (!detection.reset.shouldClear) {
      return;
    }

    applyPendingSelectionUpdate(clearPendingSelectionRuntime());
    state.progress = undefined;
    state.status = detection.reset.nextStatus;
    syncUndeliveredResultSession();
    return;
  }

  if (detection.status === 'unchanged') {
    return;
  }

  if (detection.status === 'pending') {
    if (detection.warningReason) {
      addLogEntry('warn', detection.warningReason);
    }
    const pendingUpdate = detection.update;
    state.pending = pendingUpdate.pending;
    state.pendingMessageId = pendingUpdate.pendingMessageId;
    state.pendingBatchId = pendingUpdate.pendingBatchId;
    state.pendingRequestId = pendingUpdate.pendingRequestId;
    state.lastInvalidMcpMessageId = pendingUpdate.lastInvalidMcpMessageId;
    syncRoundGuard(detection.requestId);
    state.progress = pendingUpdate.progress;
    state.retryableBatch = pendingUpdate.retryableBatch;
    state.lastError = pendingUpdate.lastError;
    state.status = pendingUpdate.status;
    addLogEntry('info', detection.batchId
      ? `Detected batch with ${pendingUpdate.pending.length} tool calls.`
      : `Detected tool call: ${pendingUpdate.pending[0]?.block.tool ?? 'unknown'}`);
    renderPanel();
    syncUndeliveredResultSession();
    void maybeAutoRunPending();
    return;
  }

  if (detection.status === 'invalid_waiting') {
    return;
  }

  const invalidUpdate = detection.update;
  state.lastInvalidMcpMessageId = invalidUpdate.lastInvalidMcpMessageId;
  state.lastError = invalidUpdate.lastError;
  state.status = invalidUpdate.status;
  if (invalidUpdate.isNewInvalidTurn) {
    addLogEntry('warn', `Blocked invalid MCP reply: ${detection.invalidReason}`);
  }
  syncUndeliveredResultSession();
  renderPanel();
}

async function runPending(): Promise<void> {
  if (hasPendingTurnBatch(state.pending.length, state.pendingBatchId)) {
    await runPendingBatch();
    return;
  }

  const pending = state.pending[0];
  if (!pending) return;
  const capability = assessPendingTools([pending], getCatalogTools(), hasLiveCatalog());
  if (!capability.runnable) {
    state.lastError = capability.blockedReason ?? 'Tool is not runnable with the current gateway capabilities.';
    renderPanel();
    return;
  }
  state.status = 'executing';
  state.lastError = undefined;
  state.lastDeliveryRecovery = undefined;
  state.preservedDraft = undefined;
  state.recoveredComposerSnapshot = undefined;
  addLogEntry('info', `Running tool: ${pending.block.tool}`);
  renderPanel();

  const request = createLegacyToolCallRequest({
    tool: pending.block.tool,
    args: pending.block.args,
    callId: pending.callId
  });

  try {
    const response = await callTool(request);
    const executeCompat = response.execute;
    const resultEnvelope = executeCompat.result.type === 'inline_tool_result'
      ? executeCompat.result
      : createInlineToolResultEnvelopeFromLegacyResponse(response, pending.callId);
    const consumedPending = consumeFirstPendingRuntime(state.pending);
    if (consumedPending.executedCallId) {
      state.executedCallIds.add(consumedPending.executedCallId);
    }
    applyPendingSelectionUpdate(consumedPending);
    state.progress = undefined;
    state.retryableBatch = undefined;
    state.lastResult = formatToolResult(pending.block.tool, resultEnvelope);
    addLogEntry('success', `Tool completed: ${pending.block.tool}${executeCompat ? ` [${executeCompat.executionId}]` : ''}`);
    state.status = await deliverLastResult('result_ready');
  } catch (err) {
    const errorCode = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
    const executeCompat = getExecuteResponseCompat(err);
    const failure = failureFromError(pending.block.tool, err);
    const resultEnvelope = executeCompat?.result.type === 'execution_error'
      ? executeCompat.result
      : createExecutionErrorEnvelopeFromLegacyResponse(failure);
    state.lastError = err instanceof Error ? err.message : 'Tool call failed';
    state.lastResult = formatToolResult(pending.block.tool, resultEnvelope);
    addLogEntry('error', `Tool failed: ${pending.block.tool}${executeCompat ? ` [${executeCompat.executionId}]` : ''} (${errorCode || 'INTERNAL_ERROR'})`);
    state.progress = undefined;
    state.retryableBatch = undefined;
    if (errorCode === 'UNAUTHORIZED') {
      state.status = 'unauthorized';
    } else {
      const consumedPending = consumeFirstPendingRuntime(state.pending);
      if (consumedPending.executedCallId) {
        state.executedCallIds.add(consumedPending.executedCallId);
      }
      applyPendingSelectionUpdate(consumedPending);
      state.status = await deliverLastResult('failed');
    }
  }
  syncUndeliveredResultSession();
  renderPanel();
}

async function runPendingBatch(): Promise<void> {
  const pending = state.pending.slice();
  const batchId = state.pendingBatchId;
  const messageId = state.pendingMessageId;
  if (pending.length < 2 || !batchId || !messageId) return;

  await runStoredBatch({
    blocks: pending,
    batchId,
    messageId
  });
}

async function retryStoppedBatch(): Promise<void> {
  const batch = state.retryableBatch;
  if (!batch) return;
  await runStoredBatch(batch);
}

async function runStoredBatch(batch: StoredBatch): Promise<void> {
  const { blocks, batchId, messageId } = batch;
  if (blocks.length < 2) return;
  const capability = assessPendingTools(blocks, getCatalogTools(), hasLiveCatalog());
  if (!capability.runnable) {
    state.lastError = capability.blockedReason ?? 'Batch is not runnable with the current gateway capabilities.';
    renderPanel();
    return;
  }

  state.status = 'batch_executing';
  state.progress = { current: 1, total: blocks.length, tool: blocks[0]?.block.tool ?? 'unknown' };
  state.lastError = undefined;
  state.lastDeliveryRecovery = undefined;
  state.preservedDraft = undefined;
  state.recoveredComposerSnapshot = undefined;
  addLogEntry('info', `Running batch with ${blocks.length} tool calls.`);
  renderPanel();

  const response = await executeBatch({
    batchId,
    messageId,
    blocks,
    executeTool: callTool,
    continueOnFailure: state.continueBatchOnError,
    onProgress: (progress) => {
      state.progress = progress;
      state.status = 'batch_executing';
      renderPanel();
    }
  });

  applyBatchExecutionMarkers(response.items, batchId);
  applyPendingSelectionUpdate(clearPendingSelectionRuntime());
  state.progress = undefined;
  state.lastResult = formatBatchToolResult(response);
  const batchDelivery = deriveBatchDeliveryOutcome({
    response,
    blocks,
    batchId,
    messageId
  });
  state.retryableBatch = batchDelivery.retryableBatch;
  state.lastError = batchDelivery.lastError;
  addLogEntry(batchDelivery.logEvent.level, batchDelivery.logEvent.message);
  state.status = await deliverLastResult(batchDelivery.readyStatus);
  syncUndeliveredResultSession();
  renderPanel();
}

function ignorePending(): void {
  const ignoredPending = createIgnoredPendingRuntimeUpdate({
    pending: state.pending,
    pendingBatchId: state.pendingBatchId
  });

  for (const callId of ignoredPending.executedCallIds) {
    state.executedCallIds.add(callId);
  }
  if (ignoredPending.executedBatchId) {
    state.executedBatchIds.add(ignoredPending.executedBatchId);
  }

  applyPendingSelectionUpdate(ignoredPending);
  state.progress = undefined;
  state.retryableBatch = undefined;
  state.preservedDraft = undefined;
  state.recoveredComposerSnapshot = undefined;

  if (ignoredPending.ignoredKind === 'batch') {
    state.status = ignoredPending.status;
    state.lastError = undefined;
    addLogEntry('info', 'Ignored pending batch.');
    syncUndeliveredResultSession();
    renderPanel();
    return;
  }

  state.status = ignoredPending.status;
  addLogEntry('info', `Ignored tool call: ${ignoredPending.ignoredTool ?? 'unknown'}`);
  syncUndeliveredResultSession();
  renderPanel();
}

function applyPendingSelectionUpdate(
  update: Pick<typeof state, 'pending' | 'pendingBatchId' | 'pendingMessageId' | 'pendingRequestId'>
): void {
  state.pending = update.pending;
  state.pendingBatchId = update.pendingBatchId;
  state.pendingMessageId = update.pendingMessageId;
  state.pendingRequestId = update.pendingRequestId;
}

function applyBatchExecutionMarkers(items: BatchResultItem[], batchId: string): void {
  for (const item of items) {
    if ('ok' in item) {
      state.executedCallIds.add(item.callId);
    }
  }
  state.executedBatchIds.add(batchId);
}

async function insertLastResult(): Promise<void> {
  if (!state.lastResult) return;
  state.status = await performLastResultDelivery(getCurrentReadyDeliveryStatus());
  syncUndeliveredResultSession();
  renderPanel();
}

function insertToolCatalog(): void {
  const tools = getCatalogTools();
  if (!hasLiveCatalog() || tools.length === 0) {
    state.lastError = 'Tool catalog unavailable. Refresh gateway capabilities.';
    renderPanel();
    return;
  }

  const inserted = insertIntoChatInput(buildToolCatalogPrompt(tools));
  if (!inserted) {
    state.lastError = 'Chat input not found. Copied the MCP list to clipboard instead.';
    addLogEntry('warn', 'Could not insert MCP list into chat input.');
  } else {
    state.lastError = undefined;
    addLogEntry('success', 'Inserted MCP list into chat input.');
  }
  renderPanel();
}

async function maybeAutoRunPending(): Promise<void> {
  if (!state.autoExecuteEnabled) return;
  if (state.status === 'executing' || state.status === 'batch_executing') return;
  if (state.pending.length === 0) return;

  const requestIdentity = resolveCurrentRequestIdentity({
    findLatestUserMessage,
    extractVisibleText,
    conversationPath: window.location.pathname,
    state: turnScanState
  });
  turnScanState = requestIdentity.nextState;
  const requestId = state.pendingRequestId ?? requestIdentity.requestId;
  syncRoundGuard(requestId);
  const capability = assessPendingTools(state.pending, getCatalogTools(), hasLiveCatalog());
  if (!capability.autoRunnable) return;

  if (!canAutoRunForRequest(
    {
      requestId: state.autoRoundRequestId,
      count: state.autoRoundCount,
      maxToolRounds: state.maxToolRounds
    },
    requestId
  )) {
    const message = `Auto tool rounds limit reached (${state.maxToolRounds}) for the current user request. Use Run or Run All to continue manually.`;
    if (state.lastError !== message) {
      addLogEntry('warn', `Auto tool rounds limit reached (${state.maxToolRounds}).`);
    }
    state.lastError = message;
    renderPanel();
    return;
  }

  const recorded = recordAutoRunForRequest(
    {
      requestId: state.autoRoundRequestId,
      count: state.autoRoundCount,
      maxToolRounds: state.maxToolRounds
    },
    requestId
  );
  state.autoRoundRequestId = recorded.requestId;
  state.autoRoundCount = recorded.count;
  await runPending();
}

async function deliverLastResult(
  readyStatus: ReadyDeliveryStatus
): Promise<BridgeStatus> {
  if (!state.autoInsertResult || !state.lastResult) {
    state.lastDeliveryRecovery = undefined;
    return readyStatus;
  }

  return performLastResultDelivery(readyStatus);
}

async function refreshToolCatalog(): Promise<void> {
  const catalog = await listCatalog();
  applyCatalogPrompt(catalog, 'live', 'refresh');
  writeStoredToolCatalog(catalog);
}

function bootstrapRequestPrompt(): void {
  const cachedCatalog = readStoredToolCatalog();
  if (!cachedCatalog || cachedCatalog.tools.length === 0) {
    return;
  }

  applyCatalogPrompt(cachedCatalog, 'cache', 'bootstrap');
}

async function warmRequestPromptFromGateway(): Promise<void> {
  try {
    const catalog = await listCatalog();
    if (catalog.tools.length === 0) {
      return;
    }

    applyCatalogPrompt(catalog, 'live', 'bootstrap');
    writeStoredToolCatalog(catalog);
  } catch {
    // Keep the cached bootstrap prompt until the regular UI-driven sync runs.
  }
}

function applyCatalogPrompt(
  catalog: CatalogContract,
  source: CatalogSource,
  reason: 'bootstrap' | 'refresh'
): void {
  setGatewayCatalog(catalog, source);
  const snapshot = createRequestPromptSnapshot(catalog, state.requestInjectionMode, source);
  syncRequestPrompt(snapshot);

  const syncKey = `${reason}:${source}:${snapshot.catalogVersion ?? ''}`;
  if (syncKey === lastRequestPromptSyncKey) {
    return;
  }

  lastRequestPromptSyncKey = syncKey;
  const syncLog = describeRequestPromptSync({ catalog, source, reason });
  addLogEntry(syncLog.level, syncLog.message);
}

function installRequestHookDiagnostics(): void {
  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as {
      source?: string;
      type?: string;
      status?: RequestHookStatus;
      transport?: string;
      url?: string;
      promptSource?: CatalogSource;
      catalogVersion?: string;
    } | undefined;
    if (!data || data.source !== 'cwmb-page-hook' || data.type !== 'cwmb:request-hook-status') {
      return;
    }
    const detail = {
      status: data.status,
      transport: data.transport,
      url: data.url,
      source: data.promptSource,
      catalogVersion: data.catalogVersion
    };
    const hookStatus = detail.status;
    if (!hookStatus) {
      return;
    }

    const key = `${hookStatus}:${detail.transport ?? 'unknown'}:${detail.source ?? 'none'}:${detail.catalogVersion ?? ''}:${detail.url ?? ''}`;
    requestHookConversationEventCount += 1;
    if (key === lastRequestHookStatusKey) {
      return;
    }
    lastRequestHookStatusKey = key;
    const nextLog = describeRequestHookStatus({
      status: hookStatus,
      transport: detail.transport,
      source: detail.source,
      catalogVersion: detail.catalogVersion
    });
    addLogEntry(nextLog.level, nextLog.message);
    renderPanel();
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function performLastResultDelivery(readyStatus: ReadyDeliveryStatus): Promise<BridgeStatus> {
  const lastResult = state.lastResult;
  if (!lastResult) {
    return readyStatus;
  }
  const isRecoveredSendResume = state.status === 'inserted' || state.status === 'batch_inserted';

  const outcome = await deliverResult({
    kind: isBatchReadyDeliveryStatus(readyStatus) ? 'batch' : 'single',
    payload: lastResult,
    autoSend: state.autoSendResult,
    allowReuseCurrentComposer: isRecoveredSendResume,
    existingError: state.lastError,
    preservedDraft: state.preservedDraft,
    insert: insertIntoChatInput,
    restore: insertIntoChatInput,
    send: sendCurrentChatInput,
    isSubmitting: isChatInputSubmitting,
    getSubmissionSignal: () => requestHookConversationEventCount,
    readCurrentInput: readCurrentChatInputText,
    wait
  });

  state.preservedDraft = outcome.nextPreservedDraft;
  state.recoveredComposerSnapshot = outcome.phase === 'sent' ? undefined : state.recoveredComposerSnapshot;
  state.lastError = outcome.nextError;
  state.lastDeliveryRecovery = outcome.recovery;
  for (const event of outcome.events) {
    addLogEntry(event.level, event.message);
  }

  return resolveDeliveredBridgeStatus(readyStatus, outcome.phase) as BridgeStatus;
}

function getCurrentReadyDeliveryStatus(): ReadyDeliveryStatus {
  return deriveDeliveryPanelState({
    status: state.status,
    lastResult: state.lastResult,
    pending: state.pending,
    pendingBatchId: state.pendingBatchId,
    retryableBatch: state.retryableBatch
  }).readyStatus;
}

async function startBridge(): Promise<void> {
  setUiHandlers({
    onRun: () => void runPending(),
    onIgnore: ignorePending,
    onRetry: () => void retryStoppedBatch(),
    onInsert: () => void insertLastResult(),
    onInsertCatalog: insertToolCatalog,
    onConfigChanged: () => void refreshGatewayStatus(),
    onToggleExecute: () => {
      toggleAutoExecute();
      addLogEntry('info', `Auto execute ${state.autoExecuteEnabled ? 'enabled' : 'disabled'}.`);
      renderPanel();
      void maybeAutoRunPending();
    },
    onToggleInsert: () => {
      toggleAutoInsert();
      addLogEntry('info', `Auto insert ${state.autoInsertResult ? 'enabled' : 'disabled'}.`);
      renderPanel();
    },
    onToggleSend: () => {
      toggleAutoSend();
      addLogEntry('info', `Auto send ${state.autoSendResult ? 'enabled' : 'disabled'}.`);
      renderPanel();
    },
    onToggleContinueBatch: () => {
      toggleContinueBatchOnError();
      addLogEntry('info', `Continue on batch error ${state.continueBatchOnError ? 'enabled' : 'disabled'}.`);
      renderPanel();
    },
    onToggleCollapsed: () => {
      togglePanelCollapsed();
      renderPanel();
    }
  });
  addLogEntry('info', 'Bridge panel mounted.');
  startupUndeliveredRecoveryDeadline = hasPersistedUndeliveredResultSession(window.location.pathname)
    ? Date.now() + STARTUP_UNDELIVERED_RECOVERY_GRACE_MS
    : 0;
  if (await restoreUndeliveredResultSessionOnStartup()) {
    addLogEntry('info', 'Restored the undelivered bridge result from the current composer after refresh.');
    if (!shouldKeepRecoveredDeliveryRetryWindow({
      status: state.status,
      lastResult: state.lastResult,
      autoSend: state.autoSendResult
    })) {
      startupUndeliveredRecoveryDeadline = 0;
    }
  }
  renderPanel();
  await maybeResumeRecoveredResultDelivery();
  void refreshGatewayStatus();
  void scanLatestAssistantMessage();
  onChatMutation(() => void handleLiveChatMutation());
  setInterval(() => {
    void refreshGatewayStatus();
    void scanLatestAssistantMessage();
  }, 30_000);
}

function syncRoundGuard(requestId: string): void {
  const next = syncAutoRoundRequest(
    {
      requestId: state.autoRoundRequestId,
      count: state.autoRoundCount,
      maxToolRounds: state.maxToolRounds
    },
    requestId
  );

  state.autoRoundRequestId = next.requestId;
  state.autoRoundCount = next.count;
}

function syncUndeliveredResultSession(): void {
  syncPersistedUndeliveredResultSession({
    conversationPath: window.location.pathname,
    currentComposerText: readCurrentChatInputText()
  });
}

async function restoreUndeliveredResultSessionOnStartup(): Promise<boolean> {
  return restorePersistedUndeliveredResultSessionOnStartup({
    readCurrentComposerText: readCurrentChatInputText,
    restorePersistedSession: ({ currentComposerText, clearOnMismatch }) => restorePersistedUndeliveredResultSession({
      conversationPath: window.location.pathname,
      currentComposerText,
      clearOnMismatch
    }),
    wait
  });
}

async function handleLiveChatMutation(): Promise<void> {
  await maybeRestoreUndeliveredResultSessionAfterHydration();
  if (startupUndeliveredRecoveryDeadline !== 0) {
    await maybeResumeRecoveredResultDelivery();
  }
  await scanLatestAssistantMessage();
}

function shouldDeferPendingDetectionForComposerDraft(): boolean {
  const composerText = readCurrentChatInputText();
  const hasMatchingRecoveredSession = hasStartupRecoveryComposerText(composerText)
    && matchesPersistedUndeliveredResultSession({
      conversationPath: window.location.pathname,
      currentComposerText: composerText
    });

  return deriveRecoveredDeliveryRuntimeState({
    status: state.status,
    lastResult: state.lastResult,
    autoSend: state.autoSendResult,
    currentComposerText: composerText,
    composerSnapshot: state.recoveredComposerSnapshot,
    preservedDraft: state.preservedDraft,
    hasMatchingPersistedSession: hasMatchingRecoveredSession
  }).shouldDeferPendingDetection;
}

async function maybeResumeRecoveredResultDelivery(): Promise<void> {
  if (recoveredDeliveryResumeInFlight) {
    return;
  }
  if (
    startupUndeliveredRecoveryDeadline !== 0
    && Date.now() < recoveredDeliveryRetryNotBefore
  ) {
    return;
  }

  const currentComposerText = readCurrentChatInputText();
  const recovered = deriveRecoveredDeliveryRuntimeState({
    status: state.status,
    lastResult: state.lastResult,
    autoSend: state.autoSendResult,
    currentComposerText,
    composerSnapshot: state.recoveredComposerSnapshot,
    preservedDraft: state.preservedDraft,
    hasMatchingPersistedSession: hasStartupRecoveryComposerText(currentComposerText)
      && matchesPersistedUndeliveredResultSession({
      conversationPath: window.location.pathname,
      currentComposerText
    })
  });
  state.preservedDraft = recovered.nextPreservedDraft;

  if (!recovered.shouldResume) {
    return;
  }

  recoveredDeliveryResumeInFlight = true;
  try {
    state.status = await performLastResultDelivery(getCurrentReadyDeliveryStatus());
    syncUndeliveredResultSession();
    renderPanel();
    if (shouldKeepRecoveredDeliveryRetryWindow({
      status: state.status,
      lastResult: state.lastResult,
      autoSend: state.autoSendResult
    })) {
      recoveredDeliveryRetryNotBefore = Date.now() + RECOVERED_DELIVERY_RETRY_COOLDOWN_MS;
      return;
    }

    startupUndeliveredRecoveryDeadline = 0;
    recoveredDeliveryRetryNotBefore = 0;
  } finally {
    recoveredDeliveryResumeInFlight = false;
  }
}

async function maybeRestoreUndeliveredResultSessionAfterHydration(): Promise<void> {
  if (state.lastResult) {
    if (!shouldKeepRecoveredDeliveryRetryWindow({
      status: state.status,
      lastResult: state.lastResult,
      autoSend: state.autoSendResult
    })) {
      startupUndeliveredRecoveryDeadline = 0;
    }
    return;
  }

  const currentComposerText = readCurrentChatInputText();
  if (!hasStartupRecoveryComposerText(currentComposerText)) {
    return;
  }

  const restored = restorePersistedUndeliveredResultSession({
    conversationPath: window.location.pathname,
    currentComposerText,
    clearOnMismatch: false
  });
  if (!restored) {
    return;
  }

  startupUndeliveredRecoveryDeadline = 0;
  addLogEntry('info', 'Restored the undelivered bridge result after composer hydration finished.');
  renderPanel();
  await maybeResumeRecoveredResultDelivery();
  if (shouldKeepRecoveredDeliveryRetryWindow({
    status: state.status,
    lastResult: state.lastResult,
    autoSend: state.autoSendResult
  })) {
    startupUndeliveredRecoveryDeadline = Date.now() + STARTUP_UNDELIVERED_RECOVERY_GRACE_MS;
  }
}

async function shouldPauseTurnScanForStartupRecovery(): Promise<boolean> {
  if (startupUndeliveredRecoveryDeadline === 0) {
    return false;
  }

  if (Date.now() >= startupUndeliveredRecoveryDeadline) {
    startupUndeliveredRecoveryDeadline = 0;
    return false;
  }

  await maybeRestoreUndeliveredResultSessionAfterHydration();
  if (state.lastResult) {
    return shouldDeferPendingDetectionForComposerDraft();
  }

  return true;
}

function failureFromError(tool: string, error: unknown): ToolCallFailure {
  const details = error && typeof error === 'object' && 'details' in error ? (error as { details?: unknown }).details : undefined;
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : 'INTERNAL_ERROR';
  const message = error instanceof Error ? error.message : 'Tool call failed';

  return {
    ok: false,
    tool,
    error: {
      code,
      message,
      details
    },
    warnings: [],
    durationMs: 0
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void startBridge();
  }, { once: true });
} else {
  void startBridge();
}
