import { buildToolCatalogPrompt } from './catalog.js';
import { assessPendingTools } from './capabilities.js';
import type { ToolCallFailure, ToolCallRequest } from '@cwmb/protocol';
import type { BatchFailureItem, BatchResultItem } from './batch.js';
import { createBatchId, executeBatch } from './batch.js';
import { callTool, health, listTools } from './gateway-client.js';
import { extractVisibleText, findLatestAssistantMessage, findLatestUserMessage, onChatMutation } from './dom.js';
import { sha256Normalized } from './hash.js';
import { formatBatchToolResult, formatToolResult, insertIntoChatInput, sendCurrentChatInput } from './inserter.js';
import { parseMcpBlocks, parseRenderedMcpBlocks } from './parser.js';
import { canAutoRunForRequest, recordAutoRunForRequest, syncAutoRoundRequest } from './round-guard.js';
import { installPageRequestHook, syncRequestPrompt } from './request-hook.js';
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
      state.tools = [];
      syncRequestPrompt('');
      state.lastError = err instanceof Error ? err.message : 'Gateway authorization failed.';
      addLogEntry('error', `Gateway unauthorized: ${state.lastError}`);
    } else {
      state.status = 'disconnected';
      state.toolCatalogLoaded = false;
      state.tools = [];
      syncRequestPrompt('');
      state.lastError = err instanceof Error ? err.message : 'Gateway disconnected';
      addLogEntry('error', `Gateway disconnected: ${state.lastError}`);
    }
  }
  renderPanel();
  void maybeAutoRunPending();
}

async function scanLatestAssistantMessage(): Promise<void> {
  if (state.status === 'executing' || state.status === 'batch_executing') return;
  const message = findLatestAssistantMessage();
  if (!message) return;
  const messageText = extractVisibleText(message);
  const messageId = getMessageIdentity(message, messageText);
  const requestId = getCurrentRequestIdentity();
  const renderedParsed = await parseRenderedMcpBlocks(message);
  const parsed = renderedParsed.blocks.length > 0 ? renderedParsed : await parseMcpBlocks(messageText);
  const normalizedBlocks = await Promise.all(parsed.blocks.map(async (item) => ({
    ...item,
    callId: await sha256Normalized(`${messageId}\n\n${item.raw}`)
  })));
  const next = normalizedBlocks.filter((item) => !state.executedCallIds.has(item.callId));
  if (next.length === 0) return;

  const batchId = next.length > 1 ? await createBatchId(messageId, next) : undefined;
  if (batchId && state.executedBatchIds.has(batchId)) return;
  if (isSamePending(next, batchId)) return;

  state.pending = next;
  state.pendingMessageId = messageId;
  state.pendingBatchId = batchId;
  state.pendingRequestId = requestId;
  syncRoundGuard(requestId);
  state.progress = undefined;
  state.retryableBatch = undefined;
  state.lastError = undefined;
  state.status = getDetectedStatus();
  addLogEntry('info', batchId ? `Detected batch with ${next.length} tool calls.` : `Detected tool call: ${next[0]?.block.tool ?? 'unknown'}`);
  renderPanel();
  void maybeAutoRunPending();
}

async function runPending(): Promise<void> {
  if (hasPendingBatch()) {
    await runPendingBatch();
    return;
  }

  const pending = state.pending[0];
  if (!pending) return;
  const capability = assessPendingTools([pending], state.tools, state.toolCatalogLoaded);
  if (!capability.runnable) {
    state.lastError = capability.blockedReason ?? 'Tool is not runnable with the current gateway capabilities.';
    renderPanel();
    return;
  }
  state.status = 'executing';
  state.lastError = undefined;
  addLogEntry('info', `Running tool: ${pending.block.tool}`);
  renderPanel();

  const request: ToolCallRequest = {
    tool: pending.block.tool,
    args: pending.block.args,
    source: {
      page: 'chatgpt',
      callId: pending.callId
    }
  };

  try {
    const response = await callTool(request);
    state.executedCallIds.add(pending.callId);
    state.pending = state.pending.slice(1);
    state.pendingBatchId = undefined;
    state.pendingMessageId = undefined;
    state.pendingRequestId = undefined;
    state.progress = undefined;
    state.retryableBatch = undefined;
    state.lastResult = formatToolResult(pending.block.tool, response);
    addLogEntry('success', `Tool completed: ${pending.block.tool}`);
    state.status = await deliverLastResult('single', 'result_ready', 'inserted', 'sent');
  } catch (err) {
    const errorCode = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
    state.lastError = err instanceof Error ? err.message : 'Tool call failed';
    state.lastResult = formatToolResult(pending.block.tool, failureFromError(pending.block.tool, err));
    addLogEntry('error', `Tool failed: ${pending.block.tool} (${errorCode || 'INTERNAL_ERROR'})`);
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
  const capability = assessPendingTools(blocks, state.tools, state.toolCatalogLoaded);
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
    addLogEntry('warn', `Batch stopped after a failure in ${response.items.find((item): item is BatchFailureItem => 'ok' in item && item.ok === false)?.tool ?? 'unknown'}.`);
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
  return message.dataset.messageId || message.id || messageText.trim();
}

function isSamePending(next: typeof state.pending, batchId?: string): boolean {
  if (next.length !== state.pending.length) return false;
  if (batchId !== state.pendingBatchId) return false;
  return next.every((item, index) => item.callId === state.pending[index]?.callId);
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
  const failed = items.find((item): item is BatchFailureItem => 'ok' in item && item.ok === false);
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
  if (!state.toolCatalogLoaded || state.tools.length === 0) {
    state.lastError = 'Tool catalog unavailable. Refresh gateway capabilities.';
    renderPanel();
    return;
  }

  const inserted = insertIntoChatInput(buildToolCatalogPrompt(state.tools));
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
  const capability = assessPendingTools(state.pending, state.tools, state.toolCatalogLoaded);
  if (!capability.runnable) return;

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
    return readyStatus;
  }

  if (!state.autoSendResult) {
    return insertedStatus;
  }

  const sent = await sendCurrentChatInput();
  if (!sent && !state.lastError) {
    state.lastError = kind === 'batch'
      ? 'Batch result inserted, but the send button was not found.'
      : 'Tool result inserted, but the send button was not found.';
  }
  return sent ? sentStatus : insertedStatus;
}

async function refreshToolCatalog(): Promise<void> {
  const tools = await listTools();
  state.tools = tools;
  state.toolCatalogLoaded = true;
  syncRequestPrompt(buildToolCatalogPrompt(tools));
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
