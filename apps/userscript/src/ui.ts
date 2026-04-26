import { assessPendingTools, formatCapabilityLabel } from './capabilities.js';
import { summarizePendingBlock } from './preview.js';
import { saveAutoInsertResult, saveBaseUrl, saveToken, state } from './state.js';

let root: HTMLDivElement | null = null;
let onRunHandler: (() => void) | null = null;
let onIgnoreHandler: (() => void) | null = null;
let onRetryHandler: (() => void) | null = null;
let onInsertHandler: (() => void) | null = null;

export function setUiHandlers(handlers: { onRun: () => void; onIgnore: () => void; onRetry: () => void; onInsert: () => void }): void {
  onRunHandler = handlers.onRun;
  onIgnoreHandler = handlers.onIgnore;
  onRetryHandler = handlers.onRetry;
  onInsertHandler = handlers.onInsert;
}

export function renderPanel(): void {
  if (!root) {
    root = document.createElement('div');
    root.id = 'cwmb-panel';
    root.style.cssText = [
      'position: fixed',
      'right: 16px',
      'bottom: 16px',
      'z-index: 2147483647',
      'width: 280px',
      'padding: 12px',
      'border: 1px solid #d0d0d0',
      'border-radius: 10px',
      'background: rgba(255,255,255,0.96)',
      'color: #222',
      'font: 13px/1.4 system-ui, sans-serif',
      'box-shadow: 0 6px 24px rgba(0,0,0,0.14)'
    ].join(';');
    document.body.appendChild(root);
  }

  const pending = state.pending[0];
  const isBatch = state.pending.length > 1 && Boolean(state.pendingBatchId);
  const visibleBatch = isBatch ? state.pending : state.retryableBatch?.blocks ?? [];
  const hasRetryableBatch = Boolean(state.retryableBatch);
  const activeBlocks = state.pending.length > 0 ? state.pending : visibleBatch;
  const capability = assessPendingTools(activeBlocks, state.tools, state.toolCatalogLoaded);
  const canInsertResult =
    Boolean(state.lastResult) &&
    (state.status === 'result_ready' || state.status === 'batch_result_ready' || state.status === 'batch_stopped_on_failure');
  const pendingList = isBatch
    ? `<ol style="margin:8px 0 0 18px;padding:0">${visibleBatch
        .map((item, index) => {
          const capabilityItem = capability.items[index];
          const suffix = capabilityItem ? ` <span style="color:#666">[${escapeHtml(formatCapabilityLabel(capabilityItem))}]</span>` : '';
          return `<li><code>${escapeHtml(summarizePendingBlock(item))}</code>${suffix}</li>`;
        })
        .join('')}</ol>`
    : hasRetryableBatch
      ? `<ol style="margin:8px 0 0 18px;padding:0">${visibleBatch
          .map((item, index) => {
            const capabilityItem = capability.items[index];
            const suffix = capabilityItem ? ` <span style="color:#666">[${escapeHtml(formatCapabilityLabel(capabilityItem))}]</span>` : '';
            return `<li><code>${escapeHtml(summarizePendingBlock(item))}</code>${suffix}</li>`;
          })
          .join('')}</ol>`
    : '';
  const canRunPending = state.pending.length > 0 && capability.runnable;
  const canRetryBatch = hasRetryableBatch && capability.runnable;
  const capabilityHint = capability.blockedReason ? `<div style="color:#a40000">${escapeHtml(capability.blockedReason)}</div>` : '';
  const riskLine = capability.highestRisk ? `<div>Risk: ${escapeHtml(capability.highestRisk)}</div>` : '';
  const progress = state.progress ? `<div>Progress: Running ${state.progress.current}/${state.progress.total}: <code>${escapeHtml(state.progress.tool)}</code></div>` : '';
  root.innerHTML = `
    <strong>ChatGPT MCP Bridge</strong>
    <div>Status: ${escapeHtml(state.status)}</div>
    <div>Gateway: ${escapeHtml(state.baseUrl)}</div>
    <div>Token: ${state.token ? 'set' : 'missing'}</div>
    <div>Auto insert: ${state.autoInsertResult ? 'on' : 'off'}</div>
    ${pending ? `<div>${isBatch ? `Detected batch: ${state.pending.length} tools` : `Detected: <code>${escapeHtml(pending.block.tool)}</code>`}</div>` : ''}
    ${!pending && hasRetryableBatch ? `<div>Retryable batch: ${visibleBatch.length} tools</div>` : ''}
    ${riskLine}
    ${pendingList}
    ${progress}
    ${capabilityHint}
    ${state.lastError ? `<div style="color:#a40000">${escapeHtml(state.lastError)}</div>` : ''}
    <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
      <button data-cwmb="token">Set token</button>
      <button data-cwmb="base-url">Set gateway URL</button>
      <button data-cwmb="toggle-auto-insert">${state.autoInsertResult ? 'Disable auto insert' : 'Enable auto insert'}</button>
      ${pending ? `${canRunPending ? `<button data-cwmb="run">${isBatch ? 'Run All' : 'Run'}</button>` : ''}<button data-cwmb="ignore">${isBatch ? 'Ignore batch' : 'Ignore'}</button><button data-cwmb="copy-json">${isBatch ? 'Copy first JSON' : 'Copy JSON'}</button>` : ''}
      ${!pending && canRetryBatch ? '<button data-cwmb="retry-batch">Retry whole batch</button>' : ''}
      ${canInsertResult ? '<button data-cwmb="insert-result">Insert result</button>' : ''}
      ${state.lastResult ? '<button data-cwmb="copy-result">Copy result</button>' : ''}
    </div>
  `;

  root.querySelector('[data-cwmb="token"]')?.addEventListener('click', () => {
    const token = prompt('Pairing token', state.token);
    if (token !== null) saveToken(token.trim());
    renderPanel();
  });
  root.querySelector('[data-cwmb="base-url"]')?.addEventListener('click', () => {
    const baseUrl = prompt('Gateway base URL', state.baseUrl);
    if (baseUrl !== null && baseUrl.trim()) {
      saveBaseUrl(baseUrl.trim());
    }
    renderPanel();
  });
  root.querySelector('[data-cwmb="toggle-auto-insert"]')?.addEventListener('click', () => {
    saveAutoInsertResult(!state.autoInsertResult);
    renderPanel();
  });
  root.querySelector('[data-cwmb="run"]')?.addEventListener('click', () => onRunHandler?.());
  root.querySelector('[data-cwmb="ignore"]')?.addEventListener('click', () => onIgnoreHandler?.());
  root.querySelector('[data-cwmb="retry-batch"]')?.addEventListener('click', () => onRetryHandler?.());
  root.querySelector('[data-cwmb="insert-result"]')?.addEventListener('click', () => onInsertHandler?.());
  root.querySelector('[data-cwmb="copy-json"]')?.addEventListener('click', () => pending && GM_setClipboard(pending.raw));
  root.querySelector('[data-cwmb="copy-result"]')?.addEventListener('click', () => state.lastResult && GM_setClipboard(state.lastResult));
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] ?? char));
}
