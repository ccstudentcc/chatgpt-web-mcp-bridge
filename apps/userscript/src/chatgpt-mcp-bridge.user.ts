import type { ToolCallRequest } from '@cwmb/protocol';
import { callTool, health } from './gateway-client.js';
import { extractVisibleText, findLatestAssistantMessage, onChatMutation } from './dom.js';
import { formatToolResult, insertIntoChatInput } from './inserter.js';
import { parseMcpBlocks } from './parser.js';
import { renderPanel, setUiHandlers } from './ui.js';
import { state } from './state.js';

async function refreshGatewayStatus(): Promise<void> {
  try {
    await health();
    state.status = state.pending.length > 0 ? 'detected' : 'idle';
    state.lastError = undefined;
  } catch (err) {
    state.status = 'disconnected';
    state.lastError = err instanceof Error ? err.message : 'Gateway disconnected';
  }
  renderPanel();
}

async function scanLatestAssistantMessage(): Promise<void> {
  const message = findLatestAssistantMessage();
  if (!message) return;
  const parsed = await parseMcpBlocks(extractVisibleText(message));
  const next = parsed.blocks.filter((item) => !state.executedCallIds.has(item.callId));
  if (next.length > 0) {
    state.pending = next;
    state.status = 'detected';
    state.lastError = undefined;
    renderPanel();
  }
}

async function runFirstPending(): Promise<void> {
  const pending = state.pending[0];
  if (!pending) return;
  state.status = 'executing';
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
    state.lastResult = formatToolResult(pending.block.tool, response);
    const inserted = insertIntoChatInput(state.lastResult);
    state.status = inserted ? 'inserted' : 'result_ready';
  } catch (err) {
    const errorCode = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
    state.status = errorCode === 'UNAUTHORIZED' ? 'unauthorized' : 'failed';
    state.lastError = err instanceof Error ? err.message : 'Tool call failed';
  }
  renderPanel();
}

function ignoreFirstPending(): void {
  const pending = state.pending[0];
  if (pending) state.executedCallIds.add(pending.callId);
  state.pending = state.pending.slice(1);
  state.status = state.pending.length > 0 ? 'detected' : 'idle';
  renderPanel();
}

setUiHandlers({ onRun: runFirstPending, onIgnore: ignoreFirstPending });
renderPanel();
void refreshGatewayStatus();
onChatMutation(() => void scanLatestAssistantMessage());
setInterval(() => void refreshGatewayStatus(), 30_000);
