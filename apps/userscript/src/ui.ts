import { saveToken, state } from './state.js';

let root: HTMLDivElement | null = null;
let onRunHandler: (() => void) | null = null;
let onIgnoreHandler: (() => void) | null = null;

export function setUiHandlers(handlers: { onRun: () => void; onIgnore: () => void }): void {
  onRunHandler = handlers.onRun;
  onIgnoreHandler = handlers.onIgnore;
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
  const pendingList = isBatch
    ? `<ol style="margin:8px 0 0 18px;padding:0">${state.pending
        .map((item) => `<li><code>${escapeHtml(item.block.tool)}</code></li>`)
        .join('')}</ol>`
    : '';
  const progress = state.progress ? `<div>Progress: Running ${state.progress.current}/${state.progress.total}: <code>${escapeHtml(state.progress.tool)}</code></div>` : '';
  root.innerHTML = `
    <strong>ChatGPT MCP Bridge</strong>
    <div>Status: ${escapeHtml(state.status)}</div>
    <div>Gateway: ${escapeHtml(state.baseUrl)}</div>
    <div>Token: ${state.token ? 'set' : 'missing'}</div>
    ${pending ? `<div>${isBatch ? `Detected batch: ${state.pending.length} tools` : `Detected: <code>${escapeHtml(pending.block.tool)}</code>`}</div>` : ''}
    ${pendingList}
    ${progress}
    ${state.lastError ? `<div style="color:#a40000">${escapeHtml(state.lastError)}</div>` : ''}
    <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
      <button data-cwmb="token">Set token</button>
      ${pending ? `<button data-cwmb="run">${isBatch ? 'Run All' : 'Run'}</button><button data-cwmb="ignore">${isBatch ? 'Ignore batch' : 'Ignore'}</button><button data-cwmb="copy-json">${isBatch ? 'Copy first JSON' : 'Copy JSON'}</button>` : ''}
      ${state.lastResult ? '<button data-cwmb="copy-result">Copy result</button>' : ''}
    </div>
  `;

  root.querySelector('[data-cwmb="token"]')?.addEventListener('click', () => {
    const token = prompt('Pairing token', state.token);
    if (token !== null) saveToken(token.trim());
    renderPanel();
  });
  root.querySelector('[data-cwmb="run"]')?.addEventListener('click', () => onRunHandler?.());
  root.querySelector('[data-cwmb="ignore"]')?.addEventListener('click', () => onIgnoreHandler?.());
  root.querySelector('[data-cwmb="copy-json"]')?.addEventListener('click', () => pending && GM_setClipboard(pending.raw));
  root.querySelector('[data-cwmb="copy-result"]')?.addEventListener('click', () => state.lastResult && GM_setClipboard(state.lastResult));
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] ?? char));
}
