import { buildToolCatalogPrompt, summarizeToolCatalog } from './catalog.js';
import { assessPendingTools, formatCapabilityLabel } from './capabilities.js';
import { summarizePendingBlock } from './preview.js';
import { saveBaseUrl, savePanelPosition, saveToken, state } from './state.js';

const LOG_STREAM_SELECTOR = '.cwmb-log-stream';
const DISCLOSURE_SELECTOR = 'details[data-cwmb-disclosure-key]';

let root: HTMLDivElement | null = null;
let dragState: { pointerId: number; offsetX: number; offsetY: number } | null = null;
let onRunHandler: (() => void) | null = null;
let onIgnoreHandler: (() => void) | null = null;
let onRetryHandler: (() => void) | null = null;
let onInsertHandler: (() => void) | null = null;
let onInsertCatalogHandler: (() => void) | null = null;
let onConfigChangedHandler: (() => void) | null = null;
let onToggleExecuteHandler: (() => void) | null = null;
let onToggleInsertHandler: (() => void) | null = null;
let onToggleSendHandler: (() => void) | null = null;
let onToggleContinueBatchHandler: (() => void) | null = null;
let onToggleCollapsedHandler: (() => void) | null = null;

export function setUiHandlers(handlers: {
  onRun: () => void;
  onIgnore: () => void;
  onRetry: () => void;
  onInsert: () => void;
  onInsertCatalog: () => void;
  onConfigChanged: () => void;
  onToggleExecute: () => void;
  onToggleInsert: () => void;
  onToggleSend: () => void;
  onToggleContinueBatch: () => void;
  onToggleCollapsed: () => void;
}): void {
  onRunHandler = handlers.onRun;
  onIgnoreHandler = handlers.onIgnore;
  onRetryHandler = handlers.onRetry;
  onInsertHandler = handlers.onInsert;
  onInsertCatalogHandler = handlers.onInsertCatalog;
  onConfigChangedHandler = handlers.onConfigChanged;
  onToggleExecuteHandler = handlers.onToggleExecute;
  onToggleInsertHandler = handlers.onToggleInsert;
  onToggleSendHandler = handlers.onToggleSend;
  onToggleContinueBatchHandler = handlers.onToggleContinueBatch;
  onToggleCollapsedHandler = handlers.onToggleCollapsed;
}

export function renderPanel(): void {
  ensureRoot();
  const scrollSnapshot = captureScrollSnapshot();
  const disclosureSnapshot = captureDisclosureSnapshot();
  root!.style.width = state.panelCollapsed ? 'min(320px, calc(100vw - 24px))' : 'min(420px, calc(100vw - 24px))';
  root!.style.maxHeight = state.panelCollapsed ? 'none' : 'min(82vh, 820px)';
  root!.style.overflow = state.panelCollapsed ? 'hidden' : 'auto';

  const pending = state.pending[0];
  const isBatch = state.pending.length > 1 && Boolean(state.pendingBatchId);
  const visibleBatch = isBatch ? state.pending : state.retryableBatch?.blocks ?? [];
  const hasRetryableBatch = Boolean(state.retryableBatch);
  const activeBlocks = state.pending.length > 0 ? state.pending : visibleBatch;
  const tools = state.catalog?.tools ?? [];
  const capability = assessPendingTools(activeBlocks, tools, state.toolCatalogLoaded);
  const manualRunReason = state.autoExecuteEnabled && capability.runnable && !capability.autoRunnable
    ? capability.autoBlockedReason
    : '';
  const canInsertResult =
    Boolean(state.lastResult) &&
    (state.status === 'result_ready'
      || state.status === 'batch_result_ready'
      || state.status === 'batch_stopped_on_failure'
      || state.status === 'failed');
  const canRunPending = state.pending.length > 0 && capability.runnable;
  const canRetryBatch = hasRetryableBatch && capability.runnable;
  const capabilityHint = capability.blockedReason ? `<div class="cwmb-callout cwmb-callout-danger">${escapeHtml(capability.blockedReason)}</div>` : '';
  const manualRunHint = manualRunReason ? `<div class="cwmb-callout cwmb-callout-info">${escapeHtml(manualRunReason)}</div>` : '';
  const progress = state.progress ? `<div class="cwmb-callout cwmb-callout-info">Running ${state.progress.current}/${state.progress.total}: <code>${escapeHtml(state.progress.tool)}</code></div>` : '';
  const catalogSummary = summarizeToolCatalog(tools);
  const toolCatalogPrompt = buildToolCatalogPrompt(tools);
  const catalogVersionLabel = state.catalog?.catalogVersion ?? 'Unavailable';
  const workspaceRootLabel = state.catalog?.workspaceRoot ?? 'Unknown';
  const statusTone = getStatusTone(state.status);
  const statusLabel = getStatusLabel(state.status);
  const tokenLabel = state.trustedLocalMode ? 'Trusted local' : state.token ? 'Token set' : 'Token missing';
  const injectionModeLabel = state.requestInjectionMode === 'synthetic_system' ? 'Synthetic system' : 'Prepend user';
  const headerButtonLabel = state.panelCollapsed ? 'Expand' : 'Collapse';
  const latestLog = state.logs[state.logs.length - 1];
  const detectedLine = pending
    ? (isBatch
      ? `<div class="cwmb-detected-line">Detected <strong>${state.pending.length}</strong> tool calls in one reply</div>${renderPendingList(visibleBatch, capability)}`
      : `<div class="cwmb-detected-line">Detected <code>${escapeHtml(pending.block.tool)}</code></div>`)
    : !pending && hasRetryableBatch
      ? `<div class="cwmb-detected-line">Retryable batch with <strong>${visibleBatch.length}</strong> tools</div>${renderPendingList(visibleBatch, capability)}`
      : '<div class="cwmb-empty-state">No pending tool calls in the current chat.</div>';
  const pendingDetails = renderPendingDetails(activeBlocks, capability);
  const resultDetails = state.lastResult
    ? `<pre>${escapeHtml(state.lastResult)}</pre>`
    : '<div class="cwmb-empty-state">No result payload yet.</div>';
  const logsHtml = state.logs.length > 0
    ? [...state.logs].reverse().map((entry) => (
      `<div class="cwmb-log-row cwmb-log-${entry.level}"><div class="cwmb-log-meta"><span class="cwmb-log-time">${escapeHtml(entry.timestamp)}</span><span class="cwmb-log-level">${escapeHtml(entry.level)}</span></div><div class="cwmb-log-message">${escapeHtml(entry.message)}</div></div>`
    )).join('')
    : '<div class="cwmb-empty-state">No events yet.</div>';
  const collapsedActionHtml = [
    pending
      ? `${((!state.autoExecuteEnabled && canRunPending) || (state.autoExecuteEnabled && canRunPending && !capability.autoRunnable)) ? renderButton('run', isBatch ? 'Run all' : 'Run', 'primary') : ''}${renderButton('ignore', isBatch ? 'Ignore batch' : 'Ignore', 'danger')}`
      : '',
    !pending && canRetryBatch ? renderButton('retry-batch', 'Retry batch', 'primary') : '',
    canInsertResult ? renderButton('insert-result', 'Insert result', 'primary') : ''
  ].filter(Boolean).join('');

  root!.innerHTML = state.panelCollapsed
    ? renderCollapsedPanel(statusTone, statusLabel, headerButtonLabel, activeBlocks.length, latestLog?.message, collapsedActionHtml)
    : `
      <style>${panelStyles()}</style>
      <div class="cwmb-shell">
        <div class="cwmb-header">
          <div class="cwmb-title-wrap" data-cwmb="drag-handle">
            <div class="cwmb-kicker">Local Bridge</div>
            <h2 class="cwmb-title">ChatGPT MCP Bridge</h2>
            <div class="cwmb-subtitle">Security-first tool relay for ChatGPT Web</div>
          </div>
          <div class="cwmb-header-actions">
            <div class="cwmb-badge ${statusTone}">${statusLabel}</div>
            <button class="cwmb-collapse-btn" data-cwmb="toggle-collapsed">${headerButtonLabel}</button>
          </div>
        </div>

        <div class="cwmb-section">
          <div class="cwmb-section-label">Runtime</div>
          <div class="cwmb-stats">
            <div class="cwmb-stat">
              <div class="cwmb-stat-label">Gateway</div>
              <div class="cwmb-stat-value">${escapeHtml(state.baseUrl)}</div>
            </div>
            <div class="cwmb-stat">
              <div class="cwmb-stat-label">Catalog</div>
              <div class="cwmb-stat-value">${state.toolCatalogLoaded ? `${catalogSummary.enabled} / ${catalogSummary.total}` : 'Unavailable'}</div>
            </div>
            <div class="cwmb-stat">
              <div class="cwmb-stat-label">Catalog ver</div>
              <div class="cwmb-stat-value">${escapeHtml(catalogVersionLabel)}</div>
            </div>
            <div class="cwmb-stat">
              <div class="cwmb-stat-label">Auth</div>
              <div class="cwmb-stat-value">${escapeHtml(tokenLabel)}</div>
            </div>
            <div class="cwmb-stat">
              <div class="cwmb-stat-label">Risk</div>
              <div class="cwmb-stat-value">${escapeHtml(capability.highestRisk ?? 'Low')}</div>
            </div>
            <div class="cwmb-stat">
              <div class="cwmb-stat-label">Injection</div>
              <div class="cwmb-stat-value">${escapeHtml(injectionModeLabel)}</div>
            </div>
            <div class="cwmb-stat">
              <div class="cwmb-stat-label">Workspace</div>
              <div class="cwmb-stat-value">${escapeHtml(workspaceRootLabel)}</div>
            </div>
          </div>
        </div>

        <div class="cwmb-section">
          <div class="cwmb-section-label">Automation</div>
          <div class="cwmb-toggle-grid">
            ${renderToggle('toggle-execute', 'Execute', state.autoExecuteEnabled)}
            ${renderToggle('toggle-insert', 'Insert', state.autoInsertResult)}
            ${renderToggle('toggle-send', 'Send', state.autoSendResult)}
            ${renderToggle('toggle-continue-batch', 'Continue on error', state.continueBatchOnError)}
          </div>
          ${state.toolCatalogLoaded ? `<div class="cwmb-callout cwmb-callout-muted">Request injection is currently using <strong>${escapeHtml(injectionModeLabel)}</strong>. Insert/Copy MCP list remains fallback only.</div>` : ''}
        </div>

        <div class="cwmb-section">
          <div class="cwmb-section-label">Detection</div>
          ${detectedLine}
          ${progress}
          ${capabilityHint}
          ${manualRunHint}
          ${state.lastError ? `<div class="cwmb-callout cwmb-callout-danger">${escapeHtml(state.lastError)}</div>` : ''}
          <details class="cwmb-disclosure" data-cwmb-disclosure-key="pending-details">
            <summary>Batch / pending details</summary>
            <div class="cwmb-disclosure-body">${pendingDetails}</div>
          </details>
          <details class="cwmb-disclosure" data-cwmb-disclosure-key="last-result">
            <summary>Last result payload</summary>
            <div class="cwmb-disclosure-body">${resultDetails}</div>
          </details>
        </div>

        <div class="cwmb-section">
          <div class="cwmb-section-label">Actions</div>
          <div class="cwmb-actions">
            ${state.trustedLocalMode ? '' : renderButton('token', 'Set token')}
            ${renderButton('base-url', 'Gateway URL')}
            ${state.toolCatalogLoaded ? `${renderButton('insert-catalog', 'Insert MCP list')}${renderButton('copy-catalog', 'Copy MCP list', 'ghost')}` : ''}
          </div>
          <div class="cwmb-actions">
            ${pending ? `${((!state.autoExecuteEnabled && canRunPending) || (state.autoExecuteEnabled && canRunPending && !capability.autoRunnable)) ? renderButton('run', isBatch ? 'Run all' : 'Run', 'primary') : ''}${renderButton('ignore', isBatch ? 'Ignore batch' : 'Ignore', 'danger')}${renderButton('copy-json', isBatch ? 'Copy first JSON' : 'Copy JSON', 'ghost')}` : ''}
            ${!pending && canRetryBatch ? renderButton('retry-batch', 'Retry whole batch', 'primary') : ''}
            ${canInsertResult ? renderButton('insert-result', 'Insert result', 'primary') : ''}
            ${state.lastResult ? renderButton('copy-result', 'Copy result', 'ghost') : ''}
          </div>
        </div>

        <div class="cwmb-section">
          <div class="cwmb-section-label">Inspector log</div>
          <div class="cwmb-log-stream">${logsHtml}</div>
        </div>
      </div>
    `;

  restoreDisclosureSnapshot(disclosureSnapshot);
  bindHandlers(toolCatalogPrompt, pending);
  restoreScrollSnapshot(scrollSnapshot);
}

function ensureRoot(): void {
  if (root) return;
  root = document.createElement('div');
  root.id = 'cwmb-panel';
  root.style.cssText = [
    'position: fixed',
    'right: 12px',
    'top: 12px',
    'z-index: 2147483647',
    'width: min(360px, calc(100vw - 24px))',
    'max-height: min(78vh, 760px)',
    'overflow: auto',
    'border-radius: 18px',
    'background: linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(2,6,23,0.96) 100%)',
    'color: #e2e8f0',
    'font: 13px/1.45 "IBM Plex Sans", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    'box-shadow: 0 18px 48px rgba(2,6,23,0.45), 0 0 0 1px rgba(148,163,184,0.16)',
    'backdrop-filter: blur(18px)',
    'scrollbar-width: thin'
  ].join(';');
  document.body.appendChild(root);
}

function bindHandlers(toolCatalogPrompt: string, pending: typeof state.pending[0] | undefined): void {
  applyPanelPosition();
  root?.querySelector('[data-cwmb="token"]')?.addEventListener('click', () => {
    const token = prompt('Pairing token', state.token);
    if (token !== null) saveToken(token.trim());
    renderPanel();
    onConfigChangedHandler?.();
  });
  root?.querySelector('[data-cwmb="base-url"]')?.addEventListener('click', () => {
    const baseUrl = prompt('Gateway base URL', state.baseUrl);
    if (baseUrl !== null && baseUrl.trim()) {
      saveBaseUrl(baseUrl.trim());
    }
    renderPanel();
    onConfigChangedHandler?.();
  });
  root?.querySelector('[data-cwmb="run"]')?.addEventListener('click', () => onRunHandler?.());
  root?.querySelector('[data-cwmb="ignore"]')?.addEventListener('click', () => onIgnoreHandler?.());
  root?.querySelector('[data-cwmb="retry-batch"]')?.addEventListener('click', () => onRetryHandler?.());
  root?.querySelector('[data-cwmb="insert-result"]')?.addEventListener('click', () => onInsertHandler?.());
  root?.querySelector('[data-cwmb="insert-catalog"]')?.addEventListener('click', () => onInsertCatalogHandler?.());
  root?.querySelector('[data-cwmb="copy-catalog"]')?.addEventListener('click', () => GM_setClipboard(toolCatalogPrompt));
  root?.querySelector('[data-cwmb="copy-json"]')?.addEventListener('click', () => pending && GM_setClipboard(pending.raw));
  root?.querySelector('[data-cwmb="copy-result"]')?.addEventListener('click', () => state.lastResult && GM_setClipboard(state.lastResult));
  root?.querySelector('[data-cwmb="toggle-execute"]')?.addEventListener('click', () => onToggleExecuteHandler?.());
  root?.querySelector('[data-cwmb="toggle-insert"]')?.addEventListener('click', () => onToggleInsertHandler?.());
  root?.querySelector('[data-cwmb="toggle-send"]')?.addEventListener('click', () => onToggleSendHandler?.());
  root?.querySelector('[data-cwmb="toggle-continue-batch"]')?.addEventListener('click', () => onToggleContinueBatchHandler?.());
  root?.querySelector('[data-cwmb="toggle-collapsed"]')?.addEventListener('click', () => onToggleCollapsedHandler?.());
  root?.querySelector('[data-cwmb="drag-handle"]')?.addEventListener('pointerdown', (event) => {
    startDrag(event as PointerEvent);
  });
}

interface ScrollSnapshot {
  panelScrollTop: number;
  log?: {
    scrollTop: number;
    scrollHeight: number;
    wasNearTop: boolean;
  };
}

type DisclosureSnapshot = Record<string, boolean>;

function captureDisclosureSnapshot(): DisclosureSnapshot {
  if (!root) {
    return {};
  }

  const snapshot: DisclosureSnapshot = {};
  for (const node of Array.from(root.querySelectorAll(DISCLOSURE_SELECTOR))) {
    if (!(node instanceof HTMLDetailsElement)) {
      continue;
    }

    const key = node.dataset.cwmbDisclosureKey;
    if (!key) {
      continue;
    }

    snapshot[key] = node.open;
  }

  return snapshot;
}

function restoreDisclosureSnapshot(snapshot: DisclosureSnapshot): void {
  if (!root) {
    return;
  }

  for (const node of Array.from(root.querySelectorAll(DISCLOSURE_SELECTOR))) {
    if (!(node instanceof HTMLDetailsElement)) {
      continue;
    }

    const key = node.dataset.cwmbDisclosureKey;
    if (!key || !(key in snapshot)) {
      continue;
    }

    node.open = snapshot[key] === true;
  }
}

function captureScrollSnapshot(): ScrollSnapshot {
  const panelScrollTop = root?.scrollTop ?? 0;
  const logStream = root?.querySelector(LOG_STREAM_SELECTOR);
  if (!(logStream instanceof HTMLDivElement)) {
    return { panelScrollTop };
  }

  return {
    panelScrollTop,
    log: {
      scrollTop: logStream.scrollTop,
      scrollHeight: logStream.scrollHeight,
      wasNearTop: logStream.scrollTop <= 8
    }
  };
}

function restoreScrollSnapshot(snapshot: ScrollSnapshot): void {
  if (!root) {
    return;
  }

  root.scrollTop = snapshot.panelScrollTop;

  if (!snapshot.log) {
    return;
  }

  const logStream = root.querySelector(LOG_STREAM_SELECTOR);
  if (!(logStream instanceof HTMLDivElement)) {
    return;
  }

  if (snapshot.log.wasNearTop) {
    logStream.scrollTop = computeRestoredLogScrollTop(snapshot.log.scrollTop, snapshot.log.scrollHeight, logStream.scrollHeight, true);
    return;
  }

  logStream.scrollTop = computeRestoredLogScrollTop(snapshot.log.scrollTop, snapshot.log.scrollHeight, logStream.scrollHeight, false);
}

export function computeRestoredLogScrollTop(
  previousScrollTop: number,
  previousScrollHeight: number,
  nextScrollHeight: number,
  wasNearTop: boolean
): number {
  if (wasNearTop) {
    return 0;
  }

  const heightDelta = Math.max(0, nextScrollHeight - previousScrollHeight);
  return previousScrollTop + heightDelta;
}

function applyPanelPosition(): void {
  if (!root) return;
  const defaultOffset = 12;
  if (!state.panelPosition) {
    root.style.right = `${defaultOffset}px`;
    root.style.top = `${defaultOffset}px`;
    root.style.left = 'auto';
    return;
  }

  const clamped = clampPanelPosition(state.panelPosition.left, state.panelPosition.top);
  root.style.left = `${clamped.left}px`;
  root.style.top = `${clamped.top}px`;
  root.style.right = 'auto';
  if (clamped.left !== state.panelPosition.left || clamped.top !== state.panelPosition.top) {
    savePanelPosition(clamped);
  }
}

function startDrag(event: PointerEvent): void {
  if (!root || event.button !== 0) return;
  const target = event.target;
  if (target instanceof HTMLElement && target.closest('button, input, textarea, select, summary, a')) {
    return;
  }

  const rect = root.getBoundingClientRect();
  dragState = {
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top
  };
  event.preventDefault();
  document.addEventListener('pointermove', onDragMove);
  document.addEventListener('pointerup', stopDrag);
  document.addEventListener('pointercancel', stopDrag);
}

function onDragMove(event: PointerEvent): void {
  if (!root || !dragState || event.pointerId !== dragState.pointerId) return;
  const clamped = clampPanelPosition(
    event.clientX - dragState.offsetX,
    event.clientY - dragState.offsetY
  );
  root.style.left = `${clamped.left}px`;
  root.style.top = `${clamped.top}px`;
  root.style.right = 'auto';
  savePanelPosition(clamped);
}

function stopDrag(event: PointerEvent): void {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  dragState = null;
  document.removeEventListener('pointermove', onDragMove);
  document.removeEventListener('pointerup', stopDrag);
  document.removeEventListener('pointercancel', stopDrag);
}

function clampPanelPosition(left: number, top: number): { left: number; top: number } {
  const margin = 8;
  const width = root?.offsetWidth ?? 420;
  const height = root?.offsetHeight ?? 320;
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const maxTop = Math.max(margin, window.innerHeight - height - margin);
  return {
    left: Math.min(Math.max(margin, left), maxLeft),
    top: Math.min(Math.max(margin, top), maxTop)
  };
}

function renderPendingList(blocks: typeof state.pending, capability: ReturnType<typeof assessPendingTools>): string {
  return `<ol class="cwmb-pending-list">${blocks.map((item, index) => {
    const capabilityItem = capability.items[index];
    const suffix = capabilityItem ? ` <span class="cwmb-pending-meta">[${escapeHtml(formatCapabilityLabel(capabilityItem))}]</span>` : '';
    return `<li><code>${escapeHtml(summarizePendingBlock(item))}</code>${suffix}</li>`;
  }).join('')}</ol>`;
}

function renderPendingDetails(blocks: typeof state.pending, capability: ReturnType<typeof assessPendingTools>): string {
  if (blocks.length === 0) {
    return '<div class="cwmb-empty-state">No pending MCP blocks.</div>';
  }

  return blocks.map((item, index) => {
    const capabilityItem = capability.items[index];
    const meta = capabilityItem ? formatCapabilityLabel(capabilityItem) : 'unknown';
    return `<div class="cwmb-detail-block"><div class="cwmb-detail-title">${escapeHtml(item.block.tool)} <span class="cwmb-detail-meta">${escapeHtml(meta)}</span></div><pre>${escapeHtml(item.raw)}</pre></div>`;
  }).join('');
}

function renderCollapsedPanel(
  statusTone: string,
  statusLabel: string,
  headerButtonLabel: string,
  activeCount: number,
  latestLogMessage: string | undefined,
  actionHtml: string
): string {
  const summary = activeCount > 0
    ? `${activeCount} pending`
    : state.lastError
      ? 'Attention needed'
      : 'Watching this chat';
  const runtimeSummary = [
    renderMiniState('Execute', state.autoExecuteEnabled),
    renderMiniState('Insert', state.autoInsertResult),
    renderMiniState('Send', state.autoSendResult),
    renderMiniState('Continue', state.continueBatchOnError)
  ].join('');

  return `
    <style>${collapsedStyles()}</style>
    <div class="cwmb-shell">
      <div class="cwmb-header">
        <div data-cwmb="drag-handle">
          <div class="cwmb-kicker">Local Bridge</div>
          <h2 class="cwmb-title">ChatGPT MCP Bridge</h2>
          <div class="cwmb-subtitle">${escapeHtml(statusLabel)} • ${escapeHtml(summary)}</div>
        </div>
        <div class="cwmb-header-actions">
          <div class="cwmb-badge ${statusTone}">${statusLabel}</div>
          <button data-cwmb="toggle-collapsed">${headerButtonLabel}</button>
        </div>
      </div>
      <div class="cwmb-collapsed-strip">${runtimeSummary}</div>
      ${actionHtml ? `<div class="cwmb-collapsed-actions">${actionHtml}</div>` : ''}
      <div class="cwmb-collapsed-note">${escapeHtml(latestLogMessage ?? state.lastError ?? state.baseUrl)}</div>
    </div>
  `;
}

function panelStyles(): string {
  return `
    #cwmb-panel, #cwmb-panel * { box-sizing: border-box; }
    #cwmb-panel::-webkit-scrollbar { width: 8px; }
    #cwmb-panel::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.25); border-radius: 999px; }
    #cwmb-panel .cwmb-shell {
      position: relative;
      padding: 14px;
      border-radius: 18px;
    }
    #cwmb-panel .cwmb-shell::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 18px;
      padding: 1px;
      background: linear-gradient(180deg, rgba(148,163,184,0.22), rgba(30,41,59,0.08));
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }
    #cwmb-panel .cwmb-header,
    #cwmb-panel .cwmb-header-actions {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    #cwmb-panel .cwmb-header { margin-bottom: 12px; }
    #cwmb-panel .cwmb-title-wrap {
      min-width: 0;
      cursor: grab;
      user-select: none;
      touch-action: none;
    }
    #cwmb-panel .cwmb-title-wrap:active { cursor: grabbing; }
    #cwmb-panel .cwmb-kicker {
      color: #38bdf8;
      font: 600 11px/1 "JetBrains Mono", "Cascadia Code", monospace;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    #cwmb-panel .cwmb-title {
      margin: 0;
      color: #f8fafc;
      font-size: 18px;
      font-weight: 600;
      line-height: 1.15;
    }
    #cwmb-panel .cwmb-subtitle {
      margin-top: 4px;
      color: #94a3b8;
      font-size: 12px;
    }
    #cwmb-panel .cwmb-badge {
      flex: 0 0 auto;
      border-radius: 999px;
      padding: 8px 12px;
      font: 600 11px/1 "JetBrains Mono", "Cascadia Code", monospace;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border: 1px solid transparent;
    }
    #cwmb-panel .cwmb-badge-ok { background: rgba(34,197,94,0.16); color: #86efac; border-color: rgba(34,197,94,0.28); }
    #cwmb-panel .cwmb-badge-warn { background: rgba(245,158,11,0.14); color: #fcd34d; border-color: rgba(245,158,11,0.24); }
    #cwmb-panel .cwmb-badge-danger { background: rgba(239,68,68,0.15); color: #fca5a5; border-color: rgba(239,68,68,0.26); }
    #cwmb-panel .cwmb-badge-info { background: rgba(56,189,248,0.14); color: #7dd3fc; border-color: rgba(56,189,248,0.24); }
    #cwmb-panel .cwmb-section {
      margin-top: 12px;
      padding: 12px;
      border-radius: 14px;
      background: rgba(15,23,42,0.58);
      border: 1px solid rgba(51,65,85,0.8);
    }
    #cwmb-panel .cwmb-section-label {
      margin: 0 0 10px;
      color: #cbd5e1;
      font: 600 11px/1 "JetBrains Mono", "Cascadia Code", monospace;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    #cwmb-panel .cwmb-stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    #cwmb-panel .cwmb-stat {
      padding: 10px;
      border-radius: 12px;
      background: rgba(30,41,59,0.72);
      border: 1px solid rgba(71,85,105,0.66);
    }
    #cwmb-panel .cwmb-stat-label {
      color: #94a3b8;
      font-size: 11px;
      margin-bottom: 6px;
    }
    #cwmb-panel .cwmb-stat-value {
      color: #f8fafc;
      font: 600 13px/1.25 "JetBrains Mono", "Cascadia Code", monospace;
      word-break: break-word;
    }
    #cwmb-panel .cwmb-toggle-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    #cwmb-panel .cwmb-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 10px;
      border-radius: 12px;
      background: rgba(30,41,59,0.72);
      border: 1px solid rgba(71,85,105,0.66);
    }
    #cwmb-panel .cwmb-toggle-label {
      color: #cbd5e1;
      font-size: 12px;
    }
    #cwmb-panel .cwmb-switch {
      appearance: none;
      border: 1px solid rgba(71,85,105,0.9);
      background: rgba(15,23,42,0.9);
      color: #cbd5e1;
      border-radius: 999px;
      padding: 7px 10px;
      min-width: 74px;
      min-height: 30px;
      font: 600 11px/1 "JetBrains Mono", "Cascadia Code", monospace;
      cursor: pointer;
      transition: background 180ms ease, border-color 180ms ease, color 180ms ease;
    }
    #cwmb-panel .cwmb-switch.is-on {
      background: linear-gradient(180deg, rgba(34,197,94,0.22), rgba(22,163,74,0.18));
      border-color: rgba(34,197,94,0.45);
      color: #dcfce7;
    }
    #cwmb-panel .cwmb-switch.is-off {
      background: rgba(127,29,29,0.18);
      border-color: rgba(148,163,184,0.24);
      color: #94a3b8;
    }
    #cwmb-panel .cwmb-detected-line,
    #cwmb-panel .cwmb-empty-state { color: #cbd5e1; }
    #cwmb-panel .cwmb-empty-state { color: #94a3b8; }
    #cwmb-panel .cwmb-detected-line code,
    #cwmb-panel code {
      font-family: "JetBrains Mono", "Cascadia Code", monospace;
      font-size: 12px;
      color: #e2e8f0;
    }
    #cwmb-panel .cwmb-pending-list {
      margin: 10px 0 0;
      padding-left: 18px;
      color: #cbd5e1;
    }
    #cwmb-panel .cwmb-pending-list li + li { margin-top: 8px; }
    #cwmb-panel .cwmb-pending-meta,
    #cwmb-panel .cwmb-detail-meta {
      color: #64748b;
      font-size: 11px;
    }
    #cwmb-panel .cwmb-disclosure {
      margin-top: 10px;
      border-radius: 12px;
      border: 1px solid rgba(71,85,105,0.66);
      background: rgba(2,6,23,0.38);
      overflow: hidden;
    }
    #cwmb-panel .cwmb-disclosure summary {
      cursor: pointer;
      list-style: none;
      padding: 10px 12px;
      color: #e2e8f0;
      font: 600 12px/1.2 "IBM Plex Sans", "Segoe UI", sans-serif;
    }
    #cwmb-panel .cwmb-disclosure summary::-webkit-details-marker { display: none; }
    #cwmb-panel .cwmb-disclosure-body {
      border-top: 1px solid rgba(51,65,85,0.7);
      padding: 10px 12px 12px;
    }
    #cwmb-panel .cwmb-detail-block + .cwmb-detail-block { margin-top: 10px; }
    #cwmb-panel .cwmb-detail-title {
      color: #f8fafc;
      font: 600 12px/1.2 "JetBrains Mono", "Cascadia Code", monospace;
      margin-bottom: 6px;
    }
    #cwmb-panel .cwmb-disclosure pre {
      margin: 0;
      padding: 10px;
      border-radius: 10px;
      overflow: auto;
      background: rgba(15,23,42,0.92);
      border: 1px solid rgba(51,65,85,0.7);
      color: #cbd5e1;
      font: 11px/1.45 "JetBrains Mono", "Cascadia Code", monospace;
      white-space: pre-wrap;
      word-break: break-word;
    }
    #cwmb-panel .cwmb-log-stream {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 240px;
      overflow: auto;
      overscroll-behavior: contain;
      padding-right: 2px;
    }
    #cwmb-panel .cwmb-log-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: stretch;
      min-width: 0;
      padding: 8px 9px;
      border-radius: 10px;
      background: rgba(15,23,42,0.82);
      border: 1px solid rgba(51,65,85,0.7);
    }
    #cwmb-panel .cwmb-log-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    #cwmb-panel .cwmb-log-time,
    #cwmb-panel .cwmb-log-level {
      font: 600 10px/1.2 "JetBrains Mono", "Cascadia Code", monospace;
      text-transform: uppercase;
      white-space: nowrap;
    }
    #cwmb-panel .cwmb-log-time {
      color: #64748b;
      font-size: 9px;
    }
    #cwmb-panel .cwmb-log-level {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      min-height: 20px;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid rgba(71,85,105,0.7);
      background: rgba(30,41,59,0.72);
      color: #94a3b8;
      font-size: 9px;
    }
    #cwmb-panel .cwmb-log-message {
      min-width: 0;
      color: #cbd5e1;
      font-size: 12px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    #cwmb-panel .cwmb-log-level::before {
      content: "";
      width: 6px;
      height: 6px;
      flex: 0 0 6px;
      border-radius: 999px;
      background: #64748b;
    }
    #cwmb-panel .cwmb-log-info .cwmb-log-level::before { background: #94a3b8; }
    #cwmb-panel .cwmb-log-success .cwmb-log-level::before { background: #86efac; }
    #cwmb-panel .cwmb-log-warn .cwmb-log-level::before { background: #fcd34d; }
    #cwmb-panel .cwmb-log-error .cwmb-log-level::before { background: #fca5a5; }
    #cwmb-panel .cwmb-log-success .cwmb-log-level { color: #86efac; }
    #cwmb-panel .cwmb-log-warn .cwmb-log-level { color: #fcd34d; }
    #cwmb-panel .cwmb-log-error .cwmb-log-level { color: #fca5a5; }
    #cwmb-panel .cwmb-callout {
      margin-top: 10px;
      padding: 10px 11px;
      border-radius: 12px;
      font-size: 12px;
      border: 1px solid transparent;
    }
    #cwmb-panel .cwmb-callout-info { background: rgba(14,116,144,0.14); border-color: rgba(14,116,144,0.35); color: #bae6fd; }
    #cwmb-panel .cwmb-callout-danger { background: rgba(127,29,29,0.24); border-color: rgba(220,38,38,0.34); color: #fecaca; }
    #cwmb-panel .cwmb-callout-muted { background: rgba(30,41,59,0.72); border-color: rgba(71,85,105,0.66); color: #94a3b8; }
    #cwmb-panel .cwmb-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    #cwmb-panel button[data-cwmb] {
      appearance: none;
      border: 1px solid rgba(71,85,105,0.9);
      background: rgba(30,41,59,0.86);
      color: #e2e8f0;
      border-radius: 10px;
      padding: 8px 11px;
      min-height: 34px;
      font: 600 12px/1 "IBM Plex Sans", "Segoe UI", sans-serif;
      cursor: pointer;
      transition: background 180ms ease, border-color 180ms ease, transform 180ms ease, color 180ms ease;
    }
    #cwmb-panel button[data-cwmb]:hover {
      background: rgba(51,65,85,0.95);
      border-color: rgba(100,116,139,0.95);
      transform: translateY(-1px);
    }
    #cwmb-panel button[data-cwmb]:focus-visible {
      outline: 2px solid #38bdf8;
      outline-offset: 2px;
    }
    #cwmb-panel .cwmb-btn-primary {
      background: linear-gradient(180deg, rgba(34,197,94,0.22), rgba(22,163,74,0.18));
      border-color: rgba(34,197,94,0.45);
      color: #dcfce7;
    }
    #cwmb-panel .cwmb-btn-primary:hover {
      background: linear-gradient(180deg, rgba(34,197,94,0.3), rgba(22,163,74,0.24));
      border-color: rgba(74,222,128,0.55);
    }
    #cwmb-panel .cwmb-btn-danger {
      background: rgba(127,29,29,0.24);
      border-color: rgba(220,38,38,0.34);
      color: #fecaca;
    }
    #cwmb-panel .cwmb-btn-danger:hover {
      background: rgba(153,27,27,0.3);
      border-color: rgba(248,113,113,0.42);
    }
    #cwmb-panel .cwmb-btn-ghost {
      background: transparent;
      color: #94a3b8;
    }
    #cwmb-panel .cwmb-collapse-btn { color: #cbd5e1; }
    #cwmb-panel .cwmb-actions + .cwmb-actions { margin-top: 8px; }
    @media (max-width: 480px) {
      #cwmb-panel { width: min(100vw - 16px, 360px) !important; }
      #cwmb-panel .cwmb-stats,
      #cwmb-panel .cwmb-toggle-grid { grid-template-columns: 1fr; }
      #cwmb-panel button[data-cwmb] { flex: 1 1 calc(50% - 4px); justify-content: center; }
    }
    @media (prefers-reduced-motion: reduce) {
      #cwmb-panel button[data-cwmb] { transition: none; }
    }
  `;
}

function collapsedStyles(): string {
  return `
    #cwmb-panel, #cwmb-panel * { box-sizing: border-box; }
    #cwmb-panel .cwmb-shell {
      position: relative;
      padding: 12px;
      border-radius: 18px;
    }
    #cwmb-panel .cwmb-shell::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 18px;
      padding: 1px;
      background: linear-gradient(180deg, rgba(148,163,184,0.22), rgba(30,41,59,0.08));
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }
    #cwmb-panel .cwmb-header,
    #cwmb-panel .cwmb-header-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    #cwmb-panel [data-cwmb="drag-handle"] {
      cursor: grab;
      user-select: none;
      touch-action: none;
    }
    #cwmb-panel [data-cwmb="drag-handle"]:active { cursor: grabbing; }
    #cwmb-panel .cwmb-kicker {
      color: #38bdf8;
      font: 600 11px/1 "JetBrains Mono", "Cascadia Code", monospace;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    #cwmb-panel .cwmb-title {
      margin: 0;
      color: #f8fafc;
      font-size: 16px;
      font-weight: 600;
    }
    #cwmb-panel .cwmb-subtitle {
      margin-top: 3px;
      color: #94a3b8;
      font-size: 12px;
    }
    #cwmb-panel .cwmb-collapsed-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }
    #cwmb-panel .cwmb-collapsed-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }
    #cwmb-panel .cwmb-mini-state {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 999px;
      background: rgba(15,23,42,0.82);
      border: 1px solid rgba(51,65,85,0.75);
      color: #cbd5e1;
      font: 600 10px/1 "JetBrains Mono", "Cascadia Code", monospace;
      text-transform: uppercase;
    }
    #cwmb-panel .cwmb-mini-state.is-on {
      border-color: rgba(34,197,94,0.38);
      color: #dcfce7;
    }
    #cwmb-panel .cwmb-mini-state.is-off {
      color: #94a3b8;
    }
    #cwmb-panel .cwmb-mini-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: #64748b;
    }
    #cwmb-panel .cwmb-mini-state.is-on .cwmb-mini-dot {
      background: #4ade80;
      box-shadow: 0 0 0 4px rgba(34,197,94,0.12);
    }
    #cwmb-panel .cwmb-collapsed-note {
      margin-top: 10px;
      padding: 9px 10px;
      border-radius: 12px;
      background: rgba(15,23,42,0.82);
      border: 1px solid rgba(51,65,85,0.75);
      color: #94a3b8;
      font-size: 12px;
      line-height: 1.35;
      word-break: break-word;
    }
    #cwmb-panel .cwmb-badge {
      border-radius: 999px;
      padding: 7px 11px;
      font: 600 11px/1 "JetBrains Mono", "Cascadia Code", monospace;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border: 1px solid transparent;
    }
    #cwmb-panel .cwmb-badge-ok { background: rgba(34,197,94,0.16); color: #86efac; border-color: rgba(34,197,94,0.28); }
    #cwmb-panel .cwmb-badge-warn { background: rgba(245,158,11,0.14); color: #fcd34d; border-color: rgba(245,158,11,0.24); }
    #cwmb-panel .cwmb-badge-danger { background: rgba(239,68,68,0.15); color: #fca5a5; border-color: rgba(239,68,68,0.26); }
    #cwmb-panel .cwmb-badge-info { background: rgba(56,189,248,0.14); color: #7dd3fc; border-color: rgba(56,189,248,0.24); }
    #cwmb-panel button[data-cwmb] {
      appearance: none;
      border: 1px solid rgba(71,85,105,0.9);
      background: rgba(30,41,59,0.86);
      color: #e2e8f0;
      border-radius: 10px;
      padding: 8px 10px;
      min-height: 34px;
      font: 600 12px/1 "IBM Plex Sans", "Segoe UI", sans-serif;
      cursor: pointer;
    }
    #cwmb-panel .cwmb-btn-primary {
      background: linear-gradient(180deg, rgba(34,197,94,0.22), rgba(22,163,74,0.18));
      border-color: rgba(34,197,94,0.45);
      color: #dcfce7;
    }
    #cwmb-panel .cwmb-btn-danger {
      background: rgba(127,29,29,0.24);
      border-color: rgba(220,38,38,0.34);
      color: #fecaca;
    }
  `;
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] ?? char));
}

function renderButton(action: string, label: string, tone: 'default' | 'primary' | 'danger' | 'ghost' = 'default'): string {
  const toneClass = tone === 'default' ? '' : ` cwmb-btn-${tone}`;
  return `<button class="${toneClass.trim()}" data-cwmb="${action}">${escapeHtml(label)}</button>`;
}

function renderToggle(action: string, label: string, enabled: boolean): string {
  return `<div class="cwmb-toggle"><span class="cwmb-toggle-label">${escapeHtml(label)}</span><button class="cwmb-switch ${enabled ? 'is-on' : 'is-off'}" data-cwmb="${action}">${enabled ? 'On' : 'Off'}</button></div>`;
}

function renderMiniState(label: string, enabled: boolean): string {
  return `<div class="cwmb-mini-state ${enabled ? 'is-on' : 'is-off'}"><span class="cwmb-mini-dot"></span><span>${escapeHtml(label)}</span></div>`;
}

function getStatusTone(status: string): string {
  if (status === 'sent' || status === 'batch_sent' || status === 'idle') return 'cwmb-badge-ok';
  if (status === 'failed' || status === 'unauthorized' || status === 'disconnected' || status === 'invalid_mcp_turn') return 'cwmb-badge-danger';
  if (status === 'detected' || status === 'detected_batch' || status === 'batch_stopped_on_failure') return 'cwmb-badge-warn';
  return 'cwmb-badge-info';
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'invalid_mcp_turn':
      return 'Invalid MCP turn';
    case 'detected_batch':
      return 'Batch queued';
    case 'batch_executing':
      return 'Batch running';
    case 'batch_result_ready':
      return 'Batch ready';
    case 'batch_inserted':
      return 'Batch inserted';
    case 'batch_sent':
      return 'Batch sent';
    case 'batch_stopped_on_failure':
      return 'Batch stopped';
    case 'result_ready':
      return 'Result ready';
    default:
      return status.replace(/_/g, ' ');
  }
}
