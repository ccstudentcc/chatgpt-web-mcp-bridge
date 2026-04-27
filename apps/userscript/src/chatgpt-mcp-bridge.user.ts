import { buildInjectedToolPrompt, buildToolCatalogPrompt } from './catalog.js';
import { readStoredToolCatalog, writeStoredToolCatalog } from './catalog-cache.js';
import { assessPendingTools } from './capabilities.js';
import {
  createExecutionErrorEnvelopeFromLegacyResponse,
  createInlineToolResultEnvelopeFromLegacyResponse,
  createLegacyToolCallRequest,
  getExecuteResponseCompat,
  type BatchResultFailureItem,
  type BatchResultItem,
  type ToolCallFailure
} from '@cwmb/protocol';
import { createBatchId, executeBatch } from './batch.js';
import { callTool, health, listCatalog } from './gateway-client.js';
import { extractVisibleText, findLatestOpenAssistantMessage, findLatestUserMessage, onChatMutation } from './dom.js';
import { isSamePendingSelection, updatePendingInvalidTurn, type PendingInvalidTurnState } from './detection-state.js';
import { sha256Normalized } from './hash.js';
import { formatBatchToolResult, formatToolResult, insertIntoChatInput, readCurrentChatInputText, sendCurrentChatInput } from './inserter.js';
import { analyzeMcpTurn } from './parser.js';
import { canAutoRunForRequest, recordAutoRunForRequest, syncAutoRoundRequest } from './round-guard.js';
import { installPageRequestHook, syncRequestPrompt, type RequestHookStatus } from './request-hook.js';
import { renderPanel, setUiHandlers } from './ui.js';
import {
  addLogEntry,
  applyAutomationSettings,
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
let nextEphemeralMessageId = 1;
let pendingInvalidTurn: PendingInvalidTurnState | null = null;
const ephemeralMessageIds = new WeakMap<HTMLElement, string>();
const INVALID_TURN_GRACE_MS = 2_000;

async function refreshGatewayStatus(): Promise<void> {
  try {
    const gatewayHealth = await health();
    applyAutomationSettings(gatewayHealth);
    await refreshToolCatalog();
    if (state.status === 'disconnected' || state.status === 'unauthorized' || state.status === 'idle' || state.status === 'detected' || state.status === 'detected_batch') {
      state.status = getDetectedStatus();
      state.lastError = undefined;
    }
    addLogEntry('success', `Gateway synced: ${state.baseUrl}`);
  } catch (err) {
    const errorCode = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (errorCode === 'UNAUTHORIZED') {
      state.status = 'unauthorized';
      state.toolCatalogLoaded = false;
      state.catalog = undefined;
      syncRequestPrompt('', state.requestInjectionMode);
      state.lastError = err instanceof Error ? err.message : 'Gateway authorization failed.';
      addLogEntry('error', `Gateway unauthorized: ${state.lastError}`);
    } else {
      state.status = 'disconnected';
      state.toolCatalogLoaded = false;
      state.catalog = undefined;
      syncRequestPrompt('', state.requestInjectionMode);
      state.lastError = err instanceof Error ? err.message : 'Gateway disconnected';
      addLogEntry('error', `Gateway disconnected: ${state.lastError}`);
    }
  }
  renderPanel();
  void maybeAutoRunPending();
}

async function scanLatestAssistantMessage(): Promise<void> {
  if (state.status === 'executing' || state.status === 'batch_executing') return;
  const requestId = getCurrentRequestIdentity();
  const latestMessage = findLatestOpenAssistantMessage();
  if (!latestMessage) {
    pendingInvalidTurn = null;
    clearPendingDetection();
    return;
  }

  const detection = await detectPendingBlocksFromMessage(latestMessage);
  if (!detection) {
    pendingInvalidTurn = null;
    clearPendingDetection();
    return;
  }

  if (detection.status === 'unchanged') {
    pendingInvalidTurn = null;
    return;
  }

  if (detection.status === 'pending') {
    const { next, messageId, batchId } = detection;
    pendingInvalidTurn = null;
    if ('warningReason' in detection) {
      addLogEntry('warn', detection.warningReason);
    }
    state.pending = next;
    state.pendingMessageId = messageId;
    state.pendingBatchId = batchId;
    state.pendingRequestId = requestId;
    state.lastInvalidMcpMessageId = undefined;
    syncRoundGuard(requestId);
    state.progress = undefined;
    state.retryableBatch = undefined;
    state.lastError = undefined;
    state.status = getDetectedStatus();
    addLogEntry('info', batchId ? `Detected batch with ${next.length} tool calls.` : `Detected tool call: ${next[0]?.block.tool ?? 'unknown'}`);
    renderPanel();
    void maybeAutoRunPending();
    return;
  }

  const now = Date.now();
  const invalidTurnState = updatePendingInvalidTurn(pendingInvalidTurn, {
    messageId: detection.messageId,
    reason: detection.invalidReason,
    fingerprint: detection.fingerprint
  }, now, INVALID_TURN_GRACE_MS);
  pendingInvalidTurn = invalidTurnState.next;
  if (!invalidTurnState.shouldBlock) {
    return;
  }

  const isNewInvalidTurn = state.lastInvalidMcpMessageId !== detection.messageId || state.lastError !== detection.invalidReason;
  state.lastInvalidMcpMessageId = detection.messageId;
  state.lastError = detection.invalidReason;
  state.status = 'invalid_mcp_turn';
  if (isNewInvalidTurn) {
    addLogEntry('warn', `Blocked invalid MCP reply: ${detection.invalidReason}`);
  }
  renderPanel();
}

function clearPendingDetection(): void {
  if (state.status === 'executing' || state.status === 'batch_executing' || state.retryableBatch) {
    return;
  }

  state.pending = [];
  state.pendingBatchId = undefined;
  state.pendingMessageId = undefined;
  state.pendingRequestId = undefined;
  state.progress = undefined;
  if (state.status === 'detected' || state.status === 'detected_batch' || state.status === 'invalid_mcp_turn') {
    state.status = 'idle';
  }
}

async function runPending(): Promise<void> {
  if (hasPendingBatch()) {
    await runPendingBatch();
    return;
  }

  const pending = state.pending[0];
  if (!pending) return;
  const capability = assessPendingTools([pending], state.catalog?.tools ?? [], state.toolCatalogLoaded);
  if (!capability.runnable) {
    state.lastError = capability.blockedReason ?? 'Tool is not runnable with the current gateway capabilities.';
    renderPanel();
    return;
  }
  state.status = 'executing';
  state.lastError = undefined;
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
    state.executedCallIds.add(pending.callId);
    state.pending = state.pending.slice(1);
    state.pendingBatchId = undefined;
    state.pendingMessageId = undefined;
    state.pendingRequestId = undefined;
    state.progress = undefined;
    state.retryableBatch = undefined;
    state.lastResult = formatToolResult(pending.block.tool, resultEnvelope);
    addLogEntry('success', `Tool completed: ${pending.block.tool}${executeCompat ? ` [${executeCompat.executionId}]` : ''}`);
    state.status = await deliverLastResult('single', 'result_ready', 'inserted', 'sent');
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
      state.executedCallIds.add(pending.callId);
      state.pending = state.pending.slice(1);
      state.pendingBatchId = undefined;
      state.pendingMessageId = undefined;
      state.pendingRequestId = undefined;
      state.status = await deliverLastResult('single', 'failed', 'inserted', 'sent');
    }
  }
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
  const capability = assessPendingTools(blocks, state.catalog?.tools ?? [], state.toolCatalogLoaded);
  if (!capability.runnable) {
    state.lastError = capability.blockedReason ?? 'Batch is not runnable with the current gateway capabilities.';
    renderPanel();
    return;
  }

  state.status = 'batch_executing';
  state.progress = { current: 1, total: blocks.length, tool: blocks[0]?.block.tool ?? 'unknown' };
  state.lastError = undefined;
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
  state.pending = [];
  state.pendingBatchId = undefined;
  state.pendingMessageId = undefined;
  state.pendingRequestId = undefined;
  state.progress = undefined;
  state.lastResult = formatBatchToolResult(response);

  if (!response.ok && response.summary.stoppedOnFailure) {
    state.retryableBatch = {
      blocks,
      batchId,
      messageId
    };
    state.lastError = buildBatchFailureMessage(response.items, true);
    addLogEntry('warn', `Batch stopped after a failure in ${response.items.find((item): item is BatchResultFailureItem => 'ok' in item && item.ok === false)?.tool ?? 'unknown'}.`);
    state.status = await deliverLastResult('batch', 'batch_stopped_on_failure', 'batch_inserted', 'batch_sent');
  } else if (!response.ok) {
    state.retryableBatch = undefined;
    state.lastError = buildBatchFailureMessage(response.items, false);
    addLogEntry('warn', `Batch completed with ${response.summary.failed} failed tool call(s).`);
    state.status = await deliverLastResult('batch', 'batch_result_ready', 'batch_inserted', 'batch_sent');
  } else {
    state.retryableBatch = undefined;
    state.lastError = undefined;
    addLogEntry('success', `Batch completed: ${response.summary.completed} tool call(s).`);
    state.status = await deliverLastResult('batch', 'batch_result_ready', 'batch_inserted', 'batch_sent');
  }
  renderPanel();
}

function ignorePending(): void {
  if (hasPendingBatch()) {
    if (state.pendingBatchId) state.executedBatchIds.add(state.pendingBatchId);
    for (const pending of state.pending) {
      state.executedCallIds.add(pending.callId);
    }
    state.pending = [];
    state.pendingBatchId = undefined;
    state.pendingMessageId = undefined;
    state.pendingRequestId = undefined;
    state.progress = undefined;
    state.retryableBatch = undefined;
    state.status = 'idle';
    state.lastError = undefined;
    addLogEntry('info', 'Ignored pending batch.');
    renderPanel();
    return;
  }

  const pending = state.pending[0];
  if (pending) state.executedCallIds.add(pending.callId);
  state.pending = state.pending.slice(1);
  state.pendingBatchId = undefined;
  state.pendingMessageId = undefined;
  state.pendingRequestId = undefined;
  state.progress = undefined;
  state.retryableBatch = undefined;
  state.status = getDetectedStatus();
  addLogEntry('info', `Ignored tool call: ${pending?.block.tool ?? 'unknown'}`);
  renderPanel();
}

function getDetectedStatus() {
  if (hasPendingBatch()) return 'detected_batch';
  return state.pending.length > 0 ? 'detected' : 'idle';
}

function hasPendingBatch(): boolean {
  return state.pending.length > 1 && Boolean(state.pendingBatchId);
}

function getMessageIdentity(message: HTMLElement, messageText: string): string {
  const explicitId = message.dataset.messageId || message.id;
  if (explicitId) {
    return explicitId;
  }

  let ephemeralId = ephemeralMessageIds.get(message);
  if (!ephemeralId) {
    const textHint = messageText.trim().slice(0, 32);
    ephemeralId = `ephemeral-message-${nextEphemeralMessageId++}${textHint ? `:${textHint}` : ''}`;
    ephemeralMessageIds.set(message, ephemeralId);
  }
  return ephemeralId;
}

function applyBatchExecutionMarkers(items: BatchResultItem[], batchId: string): void {
  for (const item of items) {
    if ('ok' in item) {
      state.executedCallIds.add(item.callId);
    }
  }
  state.executedBatchIds.add(batchId);
}

function buildBatchFailureMessage(items: BatchResultItem[], stoppedOnFailure: boolean): string {
  const failed = items.find((item): item is BatchResultFailureItem => 'ok' in item && item.ok === false);
  if (!failed) {
    return stoppedOnFailure
      ? 'Batch stopped after a tool call failed.'
      : 'Batch completed with one or more failed tool calls.';
  }
  return stoppedOnFailure
    ? `Batch stopped after \`${failed.tool}\` failed: ${failed.error.message}`
    : `Batch completed with failures. First failed tool: \`${failed.tool}\` (${failed.error.message})`;
}

async function insertLastResult(): Promise<void> {
  if (!state.lastResult) return;
  const inserted = insertIntoChatInput(state.lastResult);
  if (inserted) {
    addLogEntry('success', 'Inserted result into ChatGPT composer.');
    if (state.autoSendResult) {
      if (await sendCurrentChatInput()) {
        addLogEntry('success', 'Sent result back to ChatGPT.');
        state.status = state.status === 'batch_result_ready' || state.status === 'batch_stopped_on_failure' ? 'batch_sent' : 'sent';
      } else {
        state.lastError = state.status === 'batch_result_ready' || state.status === 'batch_stopped_on_failure'
          ? 'Batch result inserted, but the send button was not found.'
          : 'Tool result inserted, but the send button was not found.';
        addLogEntry('warn', state.lastError);
        state.status = state.status === 'batch_result_ready' || state.status === 'batch_stopped_on_failure' ? 'batch_inserted' : 'inserted';
      }
    } else {
      state.status = state.status === 'batch_result_ready' || state.status === 'batch_stopped_on_failure' ? 'batch_inserted' : 'inserted';
    }
  } else {
    state.lastError = 'Chat input not found. Result copied to clipboard fallback.';
    addLogEntry('warn', 'Could not find chat input. Result copied to clipboard fallback.');
  }
  renderPanel();
}

function insertToolCatalog(): void {
  const tools = state.catalog?.tools ?? [];
  if (!state.toolCatalogLoaded || tools.length === 0) {
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

  const requestId = state.pendingRequestId ?? getCurrentRequestIdentity();
  syncRoundGuard(requestId);
  const capability = assessPendingTools(state.pending, state.catalog?.tools ?? [], state.toolCatalogLoaded);
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
  kind: 'single' | 'batch',
  readyStatus: BridgeStatus,
  insertedStatus: BridgeStatus,
  sentStatus: BridgeStatus
): Promise<BridgeStatus> {
  if (!state.autoInsertResult || !state.lastResult) {
    return readyStatus;
  }

  const inserted = insertIntoChatInput(state.lastResult);
  if (!inserted) {
    if (!state.lastError) {
      state.lastError = 'Chat input not found. Copied the result to clipboard instead.';
    }
    addLogEntry('warn', 'Could not find chat input. Result copied to clipboard fallback.');
    return readyStatus;
  }

  addLogEntry('success', kind === 'batch'
    ? 'Inserted batch result into ChatGPT composer.'
    : 'Inserted result into ChatGPT composer.');

  if (!state.autoSendResult) {
    return insertedStatus;
  }

  const expectedComposerText = state.lastResult;
  const sent = await sendCurrentChatInput();
  const confirmed = sent ? await waitForSubmittedComposer(expectedComposerText) : false;
  if (!sent && !state.lastError) {
    state.lastError = kind === 'batch'
      ? 'Batch result inserted, but the send button was not found.'
      : 'Tool result inserted, but the send button was not found.';
  }
  if (sent && confirmed) {
    addLogEntry('success', kind === 'batch'
      ? 'Sent batch result back to ChatGPT.'
      : 'Sent result back to ChatGPT.');
  } else {
    if (sent && !confirmed && !state.lastError) {
      state.lastError = kind === 'batch'
        ? 'Batch result was inserted and the send button was clicked, but ChatGPT did not submit the composer.'
        : 'Tool result was inserted and the send button was clicked, but ChatGPT did not submit the composer.';
    }
    addLogEntry('warn', state.lastError ?? (kind === 'batch'
      ? 'Batch result inserted, but the send button was not found.'
      : 'Tool result inserted, but the send button was not found.'));
  }
  return sent && confirmed ? sentStatus : insertedStatus;
}

async function refreshToolCatalog(): Promise<void> {
  const catalog = await listCatalog();
  state.catalog = catalog;
  state.toolCatalogLoaded = true;
  const prompt = buildInjectedToolPrompt(catalog.tools);
  writeStoredToolCatalog(catalog);
  syncRequestPrompt(prompt, state.requestInjectionMode);
}

function bootstrapRequestPrompt(): void {
  const cachedCatalog = readStoredToolCatalog();
  if (!cachedCatalog || cachedCatalog.tools.length === 0) {
    return;
  }

  state.catalog = cachedCatalog;
  syncRequestPrompt(buildInjectedToolPrompt(cachedCatalog.tools), state.requestInjectionMode);
}

async function warmRequestPromptFromGateway(): Promise<void> {
  try {
    const catalog = await listCatalog();
    if (catalog.tools.length === 0) {
      return;
    }

    state.catalog = catalog;
    writeStoredToolCatalog(catalog);
    syncRequestPrompt(buildInjectedToolPrompt(catalog.tools), state.requestInjectionMode);
  } catch {
    // Keep the cached bootstrap prompt until the regular UI-driven sync runs.
  }
}

function installRequestHookDiagnostics(): void {
  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as {
      source?: string;
      type?: string;
      status?: RequestHookStatus;
      transport?: string;
      url?: string;
    } | undefined;
    if (!data || data.source !== 'cwmb-page-hook' || data.type !== 'cwmb:request-hook-status') {
      return;
    }
    const detail = {
      status: data.status,
      transport: data.transport,
      url: data.url
    };
    if (!detail?.status) {
      return;
    }

    const key = `${detail.status}:${detail.transport ?? 'unknown'}:${detail.url ?? ''}`;
    if (key === lastRequestHookStatusKey) {
      return;
    }
    lastRequestHookStatusKey = key;

    if (detail.status === 'injected') {
      addLogEntry('success', `Request hook injected MCP catalog via ${detail.transport ?? 'request'} conversation request.`);
      renderPanel();
      return;
    }

    if (detail.status === 'missing_prompt') {
      addLogEntry('warn', `Conversation request reached the page hook before the MCP catalog prompt was ready (${detail.transport ?? 'request'}).`);
      renderPanel();
      return;
    }

    addLogEntry('warn', `Conversation request matched ChatGPT, but the body shape was not patched (${detail.transport ?? 'request'}).`);
    renderPanel();
  });
}

async function detectPendingBlocksFromMessage(message: HTMLElement): Promise<{
  status: 'pending';
  next: typeof state.pending;
  messageId: string;
  batchId?: string;
} | {
  status: 'invalid';
  messageId: string;
  invalidReason: string;
  fingerprint: string;
} | {
  status: 'pending';
  next: typeof state.pending;
  messageId: string;
  batchId?: string;
  warningReason: string;
} | {
  status: 'unchanged';
} | null> {
  const messageText = extractVisibleText(message);
  const messageId = getMessageIdentity(message, messageText);
  const analysis = await analyzeMcpTurn(message, messageText);
  if (analysis.status === 'invalid') {
    return {
      status: 'invalid',
      messageId,
      invalidReason: analysis.violationReason ?? 'Assistant reply contained an invalid MCP tool-call turn.',
      fingerprint: normalizeDetectionFingerprint(messageText)
    };
  }

  const normalizedBlocks = await Promise.all(analysis.blocks.map(async (item) => ({
    ...item,
    callId: await sha256Normalized(`${messageId}\n\n${item.raw}`)
  })));
  const next = normalizedBlocks.filter((item) => !state.executedCallIds.has(item.callId));
  if (next.length === 0) {
    return null;
  }

  const batchId = next.length > 1 ? await createBatchId(messageId, next) : undefined;
  if (batchId && state.executedBatchIds.has(batchId)) {
    return null;
  }
  if (isSamePendingSelection(state.pending, state.pendingBatchId, next, batchId)) {
    return {
      status: 'unchanged'
    };
  }

  return analysis.status === 'recoverable'
    ? { status: 'pending', next, messageId, batchId, warningReason: analysis.warningReason ?? 'Recovered a valid MCP block from a mixed reply.' }
    : { status: 'pending', next, messageId, batchId };
}

async function waitForSubmittedComposer(expectedText: string): Promise<boolean> {
  const deadline = Date.now() + 3_000;
  const expected = normalizeForSubmissionCheck(expectedText);
  while (Date.now() < deadline) {
    const current = normalizeForSubmissionCheck(readCurrentChatInputText());
    if (!current) {
      return true;
    }
    if (current !== expected) {
      return true;
    }
    await wait(100);
  }
  return false;
}

function normalizeForSubmissionCheck(value: string): string {
  return value.replace(/\u00a0/g, ' ').trim();
}

function normalizeDetectionFingerprint(value: string): string {
  return value.replace(/\u00a0/g, ' ').trim();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function startBridge(): void {
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
  renderPanel();
  void refreshGatewayStatus();
  void scanLatestAssistantMessage();
  onChatMutation(() => void scanLatestAssistantMessage());
  setInterval(() => {
    void refreshGatewayStatus();
    void scanLatestAssistantMessage();
  }, 30_000);
}

function getCurrentRequestIdentity(): string {
  const message = findLatestUserMessage();
  if (!message) {
    return `conversation:${window.location.pathname}`;
  }

  const text = extractVisibleText(message);
  return getMessageIdentity(message, text);
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
  document.addEventListener('DOMContentLoaded', startBridge, { once: true });
} else {
  startBridge();
}
