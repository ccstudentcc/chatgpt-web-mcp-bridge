import { buildToolCatalogPrompt } from './catalog.js';
import { assessPendingTools } from './capabilities.js';
import type { ToolCallRequest } from '@cwmb/protocol';
import type { BatchFailureItem, BatchResultItem } from './batch.js';
import { createBatchId, executeBatch } from './batch.js';
import { callTool, health, listTools } from './gateway-client.js';
import { extractVisibleText, findLatestAssistantMessage, onChatMutation } from './dom.js';
import { sha256Normalized } from './hash.js';
import { formatBatchToolResult, formatToolResult, insertIntoChatInput, sendCurrentChatInput } from './inserter.js';
import { parseMcpBlocks, parseRenderedMcpBlocks } from './parser.js';
import { installPageRequestHook, syncRequestPrompt } from './request-hook.js';
import { renderPanel, setUiHandlers } from './ui.js';
import { applyAutomationSettings, type BridgeStatus, type StoredBatch, state } from './state.js';

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
  } catch (err) {
    const errorCode = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (errorCode === 'UNAUTHORIZED') {
      state.status = 'unauthorized';
      state.toolCatalogLoaded = false;
      state.tools = [];
      syncRequestPrompt('');
      state.lastError = err instanceof Error ? err.message : 'Gateway authorization failed.';
    } else {
      state.status = 'disconnected';
      state.toolCatalogLoaded = false;
      state.tools = [];
      syncRequestPrompt('');
      state.lastError = err instanceof Error ? err.message : 'Gateway disconnected';
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
  state.progress = undefined;
  state.retryableBatch = undefined;
  state.lastError = undefined;
  state.status = getDetectedStatus();
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
    state.progress = undefined;
    state.retryableBatch = undefined;
    state.lastResult = formatToolResult(pending.block.tool, response);
    state.status = await deliverLastResult('single', 'result_ready', 'inserted', 'sent');
  } catch (err) {
    const errorCode = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
    state.status = errorCode === 'UNAUTHORIZED' ? 'unauthorized' : 'failed';
    state.lastError = err instanceof Error ? err.message : 'Tool call failed';
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
  renderPanel();

  const response = await executeBatch({
    batchId,
    messageId,
    blocks,
    executeTool: callTool,
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
  state.progress = undefined;
  state.lastResult = formatBatchToolResult(response);

  if (!response.ok) {
    state.retryableBatch = {
      blocks,
      batchId,
      messageId
    };
    state.lastError = buildBatchFailureMessage(response.items);
    state.status = await deliverLastResult('batch', 'batch_stopped_on_failure', 'batch_inserted', 'batch_sent');
  } else {
    state.retryableBatch = undefined;
    state.lastError = undefined;
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
    state.progress = undefined;
    state.retryableBatch = undefined;
    state.status = 'idle';
    state.lastError = undefined;
    renderPanel();
    return;
  }

  const pending = state.pending[0];
  if (pending) state.executedCallIds.add(pending.callId);
  state.pending = state.pending.slice(1);
  state.pendingBatchId = undefined;
  state.pendingMessageId = undefined;
  state.progress = undefined;
  state.retryableBatch = undefined;
  state.status = getDetectedStatus();
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

function buildBatchFailureMessage(items: BatchResultItem[]): string {
  const failed = items.find((item): item is BatchFailureItem => 'ok' in item && item.ok === false);
  if (!failed) return 'Batch stopped after a tool call failed.';
  return `Batch stopped after \`${failed.tool}\` failed: ${failed.error.message}`;
}

async function insertLastResult(): Promise<void> {
  if (!state.lastResult) return;
  const inserted = insertIntoChatInput(state.lastResult);
  if (inserted) {
    if (state.autoSendResult && await sendCurrentChatInput()) {
      state.status = state.status === 'batch_result_ready' || state.status === 'batch_stopped_on_failure' ? 'batch_sent' : 'sent';
    } else {
      state.status = state.status === 'batch_result_ready' || state.status === 'batch_stopped_on_failure' ? 'batch_inserted' : 'inserted';
    }
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
  } else {
    state.lastError = undefined;
  }
  renderPanel();
}

async function maybeAutoRunPending(): Promise<void> {
  if (!state.autoExecuteEnabled) return;
  if (state.status === 'executing' || state.status === 'batch_executing') return;
  if (state.pending.length === 0) return;

  const capability = assessPendingTools(state.pending, state.tools, state.toolCatalogLoaded);
  if (!capability.runnable) return;
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
    onConfigChanged: () => void refreshGatewayStatus()
  });
  renderPanel();
  void refreshGatewayStatus();
  void scanLatestAssistantMessage();
  onChatMutation(() => void scanLatestAssistantMessage());
  setInterval(() => {
    void refreshGatewayStatus();
    void scanLatestAssistantMessage();
  }, 30_000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startBridge, { once: true });
} else {
  startBridge();
}
