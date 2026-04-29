import { useId, useState } from 'react';

import {
  getToggleActionRequest,
  type WorkSurfaceActionRequest,
  type WorkSurfaceSnapshot
} from '../operator-workflows/index.js';
import workSurfaceCss from './work-surface.css?inline';

type HostKind = 'floating_panel' | 'side_panel';

interface SharedProps {
  host: HostKind;
  snapshot: WorkSurfaceSnapshot;
  onAction: (action: WorkSurfaceActionRequest) => Promise<void> | void;
  onOpenOptions: () => void;
}

interface FloatingPanelSurfaceProps extends SharedProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function FloatingPanelSurface({
  collapsed,
  host,
  onAction,
  onOpenOptions,
  onToggleCollapsed,
  snapshot
}: FloatingPanelSurfaceProps) {
  const [collapsedBusyAction, setCollapsedBusyAction] = useState<string | null>(null);

  async function runCollapsedAction(action: WorkSurfaceActionRequest): Promise<void> {
    if (collapsedBusyAction) {
      return;
    }

    setCollapsedBusyAction(action.type);
    try {
      await onAction(action);
    } finally {
      setCollapsedBusyAction(null);
    }
  }

  function openOptionsPage(): void {
    if (collapsedBusyAction) {
      return;
    }

    onOpenOptions();
  }

  return (
    <>
      <style>{workSurfaceCss}</style>
      <section className="cwmb-work-surface">
        <div className="cwmb-work-surface__shell cwmb-work-surface__shell--floating">
          <article className="cwmb-work-surface__card cwmb-work-surface__card--floating">
            {collapsed ? (
              <CollapsedSurface
                busy={collapsedBusyAction !== null}
                onAction={runCollapsedAction}
                onOpenOptions={openOptionsPage}
                onToggleCollapsed={onToggleCollapsed}
                snapshot={snapshot}
              />
            ) : (
              <>
                <div className="cwmb-work-surface__content">
                  <SurfaceHeader
                    host={host}
                    onToggleCollapsed={onToggleCollapsed}
                    snapshot={snapshot}
                  />
                  <WorkSurfaceBody
                    host={host}
                    onAction={onAction}
                    onOpenOptions={onOpenOptions}
                    snapshot={snapshot}
                  />
                </div>
                <ResizeHandle />
              </>
            )}
          </article>
        </div>
      </section>
    </>
  );
}

export function SharedWorkSurface({
  host,
  onAction,
  onOpenOptions,
  snapshot
}: SharedProps) {
  return (
    <>
      <style>{workSurfaceCss}</style>
      <section className="cwmb-work-surface">
        <div className={`cwmb-work-surface__shell cwmb-work-surface__shell--${host === 'side_panel' ? 'sidepanel' : 'floating'}`}>
          <article className={`cwmb-work-surface__card cwmb-work-surface__card--${host === 'side_panel' ? 'sidepanel' : 'floating'}`}>
            <div className={`cwmb-work-surface__content cwmb-work-surface__content--${host === 'side_panel' ? 'sidepanel' : 'floating'}`}>
              <SurfaceHeader host={host} snapshot={snapshot} />
              <WorkSurfaceBody
                host={host}
                onAction={onAction}
                onOpenOptions={onOpenOptions}
                snapshot={snapshot}
              />
            </div>
          </article>
        </div>
      </section>
    </>
  );
}

function SurfaceHeader({
  host,
  onToggleCollapsed,
  snapshot
}: {
  host: HostKind;
  onToggleCollapsed?: () => void;
  snapshot: WorkSurfaceSnapshot;
}) {
  return (
    <header className="cwmb-work-surface__header">
      <div className={host === 'floating_panel' ? 'cwmb-work-surface__drag-handle' : undefined} data-cwmb-drag-handle={host === 'floating_panel' ? 'true' : undefined}>
        <div className="cwmb-work-surface__eyebrow">
          {host === 'side_panel' ? 'CWMB Side Panel' : 'CWMB Floating Panel'}
        </div>
        <h1 className="cwmb-work-surface__title">{snapshot.title}</h1>
        <p className="cwmb-work-surface__subtitle">{snapshot.subtitle}</p>
      </div>

      <div className="cwmb-work-surface__header-meta">
          <Badge tone="info">{formatMode(snapshot.mode)}</Badge>
          <Badge tone={normalizeBadgeTone(snapshot.view.statusTone)}>{snapshot.view.statusLabel}</Badge>
        {onToggleCollapsed ? (
          <button
            className="cwmb-work-surface__badge cwmb-work-surface__collapse"
            onClick={onToggleCollapsed}
            type="button"
          >
            {snapshot.view.headerButtonLabel}
          </button>
        ) : null}
      </div>
    </header>
  );
}

function WorkSurfaceBody({
  host,
  onAction,
  onOpenOptions,
  snapshot
}: SharedProps) {
  const [pendingOpen, setPendingOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [localNotice, setLocalNotice] = useState<string>();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const pendingId = useId();
  const resultId = useId();
  const logsId = useId();

  const notices = [
    snapshot.view.automationNotice,
    snapshot.view.progressNotice,
    snapshot.view.capabilityNotice,
    snapshot.view.manualRunNotice,
    snapshot.view.errorNotice,
    snapshot.view.recoveryNotice
  ].filter(Boolean);

  const actionDisabled = busyAction !== null;

  async function runActionRequest(actionKey: string, action: WorkSurfaceActionRequest): Promise<void> {
    if (busyAction) {
      return;
    }

    setBusyAction(actionKey);
    setLocalNotice(undefined);
    try {
      await onAction(action);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleButton(action: string): Promise<void> {
    if (action === 'copy-catalog') {
      await copyText(snapshot.toolCatalogPrompt, 'Copied MCP list.');
      return;
    }
    if (action === 'copy-json') {
      await copyText(snapshot.view.copyJsonPayload, 'Copied the pending MCP payload.');
      return;
    }
    if (action === 'copy-result') {
      await copyText(snapshot.view.copyResultPayload, 'Copied the last result.');
      return;
    }
    if (action === 'token') {
      const token = window.prompt('Pairing token', '');
      if (token !== null) {
        await onAction({ type: 'update_token', token: token.trim() });
      }
      return;
    }
    if (action === 'base-url') {
      const baseUrl = window.prompt('Gateway base URL', '');
      if (baseUrl !== null && baseUrl.trim()) {
        await onAction({ type: 'update_base_url', baseUrl: baseUrl.trim() });
      }
      return;
    }
    if (action === 'run') {
      await runActionRequest('run_pending', { type: 'run_pending' });
      return;
    }
    if (action === 'ignore') {
      await runActionRequest('ignore_pending', { type: 'ignore_pending' });
      return;
    }
    if (action === 'retry-batch') {
      await runActionRequest('retry_batch', { type: 'retry_batch' });
      return;
    }
    if (action === 'insert-result') {
      await runActionRequest('insert_result', { type: 'insert_result' });
      return;
    }
    if (action === 'insert-catalog') {
      await runActionRequest('insert_catalog', { type: 'insert_catalog' });
      return;
    }
    if (action === 'toggle-execute') {
      await runActionRequest('toggle_execute', { type: 'toggle_execute' });
      return;
    }
    if (action === 'toggle-insert') {
      await runActionRequest('toggle_insert', { type: 'toggle_insert' });
      return;
    }
    if (action === 'toggle-send') {
      await runActionRequest('toggle_send', { type: 'toggle_send' });
      return;
    }
    if (action === 'toggle-continue-batch') {
      await runActionRequest('toggle_continue_batch', { type: 'toggle_continue_batch' });
      return;
    }
  }

  async function copyText(value: string | undefined, successMessage: string): Promise<void> {
    if (!value) {
      setLocalNotice('Nothing to copy from the current work surface state.');
      return;
    }

    await navigator.clipboard.writeText(value);
    setLocalNotice(successMessage);
  }

  return (
    <>
      <section className="cwmb-work-surface__topline">
        <MiniCard label="Bound path" value={snapshot.conversationPath} />
        <MiniCard label="Panel size" value={formatPanelSize(snapshot)} />
        <MiniCard label="Mode rule" value="Popup and options may switch hosts; the work surface may not." />
      </section>

      <section className="cwmb-work-surface__band">
        <h2 className="cwmb-work-surface__band-title">Main Actions</h2>
        <div className="cwmb-work-surface__notices">
          {localNotice ? <Notice tone="muted">{localNotice}</Notice> : null}
          {notices.map((notice, index) => (
            notice ? <Notice key={`${notice.message}-${index}`} tone={notice.tone}>{notice.message}</Notice> : null
          ))}
        </div>
        <div className="cwmb-work-surface__details" style={{ marginTop: notices.length > 0 || localNotice ? 12 : 0 }}>
          <details open={pendingOpen} onToggle={(event) => setPendingOpen((event.target as HTMLDetailsElement).open)}>
            <summary aria-controls={pendingId}>{snapshot.view.pendingDisclosureLabel}</summary>
            <div className="cwmb-work-surface__details-body" id={pendingId}>
              {snapshot.view.detectionListItems.length > 0 ? (
                <ol className="cwmb-work-surface__pending-list">
                  {snapshot.view.detectionListItems.map((item, index) => (
                    <li key={`${item.tool}-${index}`}>
                      <code>{item.summary}</code>{' '}
                      <span className="cwmb-work-surface__pending-meta">[{item.capabilityLabel}]</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="cwmb-work-surface__empty">{snapshot.view.detectionText}</div>
              )}
              {snapshot.view.detailItems.map((item, index) => (
                <div className="cwmb-work-surface__detail-block" key={`${item.tool}-raw-${index}`}>
                  <div className="cwmb-work-surface__detail-title">
                    {item.tool} <span className="cwmb-work-surface__pending-meta">{item.capabilityLabel}</span>
                  </div>
                  <pre>{item.raw || item.summary}</pre>
                </div>
              ))}
            </div>
          </details>
        </div>

        <div className="cwmb-work-surface__actions" style={{ marginTop: 12 }}>
          {snapshot.view.intentActions.map((button) => (
            <ActionButton
              button={button}
              disabled={actionDisabled}
              key={button.action}
              onClick={() => void handleButton(button.action)}
            />
          ))}
        </div>
      </section>

      <section className="cwmb-work-surface__band">
        <h2 className="cwmb-work-surface__band-title">Runtime Detail</h2>
        <div className="cwmb-work-surface__stats">
          {snapshot.view.runtimeStats.map((stat) => (
            <div className="cwmb-work-surface__stat" key={stat.label}>
              <div className="cwmb-work-surface__stat-label">{stat.label}</div>
              <div className="cwmb-work-surface__stat-value">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="cwmb-work-surface__details" style={{ marginTop: 12 }}>
          <details open={resultOpen} onToggle={(event) => setResultOpen((event.target as HTMLDetailsElement).open)}>
            <summary aria-controls={resultId}>{snapshot.view.resultDisclosureLabel}</summary>
            <div className="cwmb-work-surface__details-body" id={resultId}>
              {snapshot.view.resultPayload ? (
                <pre>{snapshot.view.resultPayload}</pre>
              ) : (
                <div className="cwmb-work-surface__empty">{snapshot.view.resultEmptyState}</div>
              )}
            </div>
          </details>
        </div>
      </section>

      <section className="cwmb-work-surface__band">
        <h2 className="cwmb-work-surface__band-title">Secondary Settings</h2>
        <div className="cwmb-work-surface__actions">
          {snapshot.view.configActions.map((button) => (
            <ActionButton
              button={button}
              disabled={actionDisabled}
              key={button.action}
              onClick={() => void handleButton(button.action)}
            />
          ))}
          <button
            className="cwmb-work-surface__button cwmb-work-surface__button--ghost"
            disabled={actionDisabled}
            onClick={() => void onOpenOptions()}
            type="button"
          >
            Open full options
          </button>
          <button
            className="cwmb-work-surface__button cwmb-work-surface__button--ghost"
            disabled={actionDisabled}
            onClick={() => void runActionRequest('refresh_gateway', { type: 'refresh_gateway' })}
            type="button"
          >
            Refresh gateway
          </button>
        </div>

        <div className="cwmb-work-surface__toggles" style={{ marginTop: 12 }}>
          {snapshot.view.toggles.map((toggle) => (
            <div className="cwmb-work-surface__toggle" key={toggle.action}>
              <div className="cwmb-work-surface__toggle-label">{toggle.label}</div>
              <button
                aria-pressed={toggle.enabled}
                className={`cwmb-work-surface__toggle-button ${toggle.enabled ? 'cwmb-work-surface__toggle-button--on' : 'cwmb-work-surface__toggle-button--off'}`}
                disabled={actionDisabled}
                onClick={() => void handleButton(toggle.action)}
                type="button"
              >
                {toggle.enabled ? 'On' : 'Off'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="cwmb-work-surface__band">
        <h2 className="cwmb-work-surface__band-title">Diagnostics</h2>
        <div className="cwmb-work-surface__details">
          <details open={logsOpen} onToggle={(event) => setLogsOpen((event.target as HTMLDetailsElement).open)}>
            <summary aria-controls={logsId}>Inspector log</summary>
            <div className="cwmb-work-surface__details-body" id={logsId}>
              {snapshot.view.logEntries.length > 0 ? (
                <div className="cwmb-work-surface__logs">
                  {snapshot.view.logEntries.map((entry, index) => (
                    <div className="cwmb-work-surface__log" key={`${entry.timestamp}-${index}`}>
                      <div className="cwmb-work-surface__log-meta">
                        <span>{entry.timestamp}</span>
                        <span className="cwmb-work-surface__log-level">{entry.level}</span>
                      </div>
                      <div className="cwmb-work-surface__log-message">{entry.message}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cwmb-work-surface__empty">No events yet.</div>
              )}
            </div>
          </details>
        </div>
      </section>
    </>
  );
}

function CollapsedSurface({
  busy,
  onAction,
  onOpenOptions,
  onToggleCollapsed,
  snapshot
}: {
  busy: boolean;
  onAction: (action: WorkSurfaceActionRequest) => Promise<void> | void;
  onOpenOptions: () => void;
  onToggleCollapsed: () => void;
  snapshot: WorkSurfaceSnapshot;
}) {
  const note = snapshot.view.latestLogMessage
    ?? snapshot.view.errorNotice?.message
    ?? snapshot.conversationPath;

  return (
    <div className="cwmb-work-surface__collapsed">
      <div className="cwmb-work-surface__collapsed-row">
        <div className="cwmb-work-surface__drag-handle" data-cwmb-drag-handle="true">
          <div className="cwmb-work-surface__eyebrow">CWMB Floating Panel</div>
          <h1 className="cwmb-work-surface__title" style={{ fontSize: 18 }}>{snapshot.title}</h1>
          <div className="cwmb-work-surface__subtitle">
            {snapshot.view.statusLabel} • {snapshot.view.collapsedSummary}
          </div>
        </div>
        <div className="cwmb-work-surface__header-meta">
          <Badge tone={normalizeBadgeTone(snapshot.view.statusTone)}>{snapshot.view.statusLabel}</Badge>
          <button className="cwmb-work-surface__badge cwmb-work-surface__collapse" onClick={onToggleCollapsed} type="button">
            {snapshot.view.headerButtonLabel}
          </button>
        </div>
      </div>

      <div className="cwmb-work-surface__actions">
        {snapshot.view.collapsedActions.map((button) => (
          <ActionButton
            button={button}
            disabled={busy}
            key={button.action}
            onClick={() => void handleCollapsedAction(button.action, onAction)}
          />
        ))}
        {snapshot.view.toggles
          .map((toggle) => {
            const action = getToggleActionRequest(toggle);
            return action ? { action, label: toggle.label } : null;
          })
          .filter((item): item is { action: WorkSurfaceActionRequest; label: string } => item !== null)
          .map((item, index) => (
            <button
              aria-pressed={isToggleEnabled(snapshot, item.label)}
              className={`cwmb-work-surface__button ${isToggleEnabled(snapshot, item.label) ? 'cwmb-work-surface__button--toggle-on' : 'cwmb-work-surface__button--toggle-off'}`}
              disabled={busy}
              key={`collapsed-toggle-${index}`}
              onClick={() => void onAction(item.action)}
              type="button"
            >
              {item.label}: {isToggleEnabled(snapshot, item.label) ? 'On' : 'Off'}
            </button>
          ))}
      </div>
      <div className="cwmb-work-surface__collapsed-note">{note}</div>
      <ResizeHandle />
    </div>
  );
}

async function handleCollapsedAction(
  action: string,
  onAction: (action: WorkSurfaceActionRequest) => Promise<void> | void
): Promise<void> {
  if (action === 'run') {
    await onAction({ type: 'run_pending' });
    return;
  }
  if (action === 'ignore') {
    await onAction({ type: 'ignore_pending' });
    return;
  }
  if (action === 'retry-batch') {
    await onAction({ type: 'retry_batch' });
    return;
  }
  if (action === 'insert-result') {
    await onAction({ type: 'insert_result' });
  }
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="cwmb-work-surface__mini">
      <div className="cwmb-work-surface__mini-label">{label}</div>
      <div className="cwmb-work-surface__mini-value">{value}</div>
    </div>
  );
}

function Badge({ children, tone }: { children: string; tone: 'danger' | 'info' | 'ok' | 'warn' }) {
  return <div className={`cwmb-work-surface__badge cwmb-work-surface__badge--${tone}`}>{children}</div>;
}

function Notice({ children, tone }: { children: string; tone: 'danger' | 'info' | 'muted' | 'warn' }) {
  return <div className={`cwmb-work-surface__notice cwmb-work-surface__notice--${tone}`}>{children}</div>;
}

function ActionButton({
  button,
  disabled = false,
  onClick
}: {
  button: { action: string; label: string; tone: 'danger' | 'default' | 'ghost' | 'primary' };
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`cwmb-work-surface__button ${toneClass(button.tone)}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {button.label}
    </button>
  );
}

function toneClass(tone: 'danger' | 'default' | 'ghost' | 'primary'): string {
  if (tone === 'primary') {
    return 'cwmb-work-surface__button--primary';
  }
  if (tone === 'danger') {
    return 'cwmb-work-surface__button--danger';
  }
  if (tone === 'ghost') {
    return 'cwmb-work-surface__button--ghost';
  }
  return '';
}

function formatMode(mode: WorkSurfaceSnapshot['mode']): string {
  return mode === 'side_panel' ? 'Chrome side panel' : 'Floating panel';
}

function normalizeBadgeTone(tone: string): 'danger' | 'info' | 'ok' | 'warn' {
  if (tone === 'cwmb-badge-danger') {
    return 'danger';
  }
  if (tone === 'cwmb-badge-warn') {
    return 'warn';
  }
  if (tone === 'cwmb-badge-ok') {
    return 'ok';
  }
  return 'info';
}

function ResizeHandle() {
  return (
    <div
      aria-label="Resize floating panel"
      className="cwmb-work-surface__resize-handle"
      data-cwmb-resize-handle="true"
      role="presentation"
    />
  );
}

function formatPanelSize(snapshot: WorkSurfaceSnapshot): string {
  if (!snapshot.panelSize) {
    return 'Auto';
  }

  return `${snapshot.panelSize.width} × ${snapshot.panelSize.height}`;
}

function isToggleEnabled(snapshot: WorkSurfaceSnapshot, label: string): boolean {
  return snapshot.view.toggles.find((toggle) => toggle.label === label)?.enabled ?? false;
}
