import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import {
  focusRecentChatGptTab,
  openNewChatGptTab,
  openSidePanelHost,
  type WorkSurfaceContext
} from '../extension-shell/work-surface.js';
import {
  getExtensionSettings,
  getWorkSurfaceContext,
  openExtensionOptionsPage,
  updateExtensionSettings
} from '../settings/runtime-client.js';
import type {
  BooleanSettingOverride,
  ExtensionSettingsSnapshot,
  WorkSurfaceMode
} from '../settings/contracts.js';

type Surface = 'popup' | 'options';
type OptionsSection = 'general' | 'connection' | 'automation' | 'interface' | 'diagnostics';

const POPUP_TOGGLE_FIELDS = [
  { key: 'autoExecute' as const, label: 'Auto execute low-risk calls' }
];

const AUTOMATION_FIELDS = [
  { key: 'autoExecute' as const, label: 'Auto execute low-risk calls' },
  { key: 'autoInsert' as const, label: 'Auto insert results' },
  { key: 'autoSend' as const, label: 'Auto send inserted results' }
];

const OPTIONS_SECTIONS: Array<{
  id: OptionsSection;
  title: string;
  description: string;
}> = [
  {
    id: 'general',
    title: 'General',
    description: 'Choose the active work-surface host and launch into the current ChatGPT runtime.'
  },
  {
    id: 'connection',
    title: 'Connection',
    description: 'Gateway URL, pairing token, and request-injection policy.'
  },
  {
    id: 'automation',
    title: 'Automation',
    description: 'Background-owned execution, insert, send, and batch continuation preferences.'
  },
  {
    id: 'interface',
    title: 'Interface',
    description: 'Read-model rules and surface hierarchy expectations for the extension shell.'
  },
  {
    id: 'diagnostics',
    title: 'Diagnostics',
    description: 'Bridge summaries, request-hook status, and the latest runtime error snapshot.'
  }
];

const STATUS_TONE: Record<string, string> = {
  disconnected: 'bg-rose-100 text-rose-700',
  unauthorized: 'bg-amber-100 text-amber-700',
  idle: 'bg-teal-100 text-teal-700',
  detected: 'bg-cyan-100 text-cyan-700',
  detected_batch: 'bg-cyan-100 text-cyan-700',
  executing: 'bg-emerald-100 text-emerald-700',
  batch_executing: 'bg-emerald-100 text-emerald-700',
  invalid_mcp_turn: 'bg-orange-100 text-orange-700',
  failed: 'bg-rose-100 text-rose-700'
};

function normalizeSummaryStatus(context: WorkSurfaceContext | null): string {
  const summary = getDisplaySummary(context);
  if (!summary) {
    return 'No active ChatGPT tab';
  }

  return summary.status.replaceAll('_', ' ');
}

function summarizeConfigMode(value: BooleanSettingOverride): string {
  if (value === 'inherit') {
    return 'Inherit gateway default';
  }

  return value ? 'Forced on' : 'Forced off';
}

function formatWorkSurfaceMode(value: WorkSurfaceMode): string {
  return value === 'side_panel' ? 'Chrome side panel' : 'Floating panel';
}

function getDisplaySummary(context: WorkSurfaceContext | null) {
  return context?.activeSummary ?? context?.latestSummary ?? null;
}

function formatLaunchTarget(context: WorkSurfaceContext | null): string {
  if (context?.activeTabIsChatGpt) {
    return 'Current ChatGPT tab';
  }
  if (context?.latestChatGptTabId) {
    return 'Latest ChatGPT tab';
  }
  return 'Open a new ChatGPT tab';
}

export function ExtensionConsoleApp({ surface }: { surface: Surface }) {
  const [settings, setSettings] = useState<ExtensionSettingsSnapshot | null>(null);
  const [context, setContext] = useState<WorkSurfaceContext | null>(null);
  const [draftBaseUrl, setDraftBaseUrl] = useState('');
  const [draftToken, setDraftToken] = useState('');
  const [connectionDraftDirty, setConnectionDraftDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [activeSection, setActiveSection] = useState<OptionsSection>('general');

  useEffect(() => {
    void refresh();

    const storageListener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
      if (areaName === 'local' && changes.cwmb_extension_settings) {
        void refresh();
      }
    };
    const tabListener = () => {
      void refreshContext();
    };

    chrome.storage.onChanged.addListener(storageListener);
    chrome.tabs?.onActivated?.addListener(tabListener);
    chrome.tabs?.onUpdated?.addListener(tabListener);

    return () => {
      chrome.storage.onChanged.removeListener(storageListener);
      chrome.tabs?.onActivated?.removeListener(tabListener);
      chrome.tabs?.onUpdated?.removeListener(tabListener);
    };
  }, []);

  async function refresh(): Promise<void> {
    try {
      const [nextSettings, nextContext] = await Promise.all([
        getExtensionSettings(),
        getWorkSurfaceContext()
      ]);
      setSettings(nextSettings);
      setContext(nextContext);
      if (!connectionDraftDirty) {
        setDraftBaseUrl(nextSettings.baseUrl);
        setDraftToken(nextSettings.token);
      }
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load extension state.');
    }
  }

  async function refreshContext(): Promise<void> {
    try {
      setContext(await getWorkSurfaceContext());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to refresh work-surface context.');
    }
  }

  async function persist(
    patch: Partial<ExtensionSettingsSnapshot>,
    options?: {
      launchAfterSave?: boolean;
      successMessage?: string;
    }
  ): Promise<void> {
    setSaving(true);
    setSaveMessage(undefined);
    setErrorMessage(undefined);

    try {
      const next = await updateExtensionSettings(patch);
      setSettings(next);

      const nextContext = await getWorkSurfaceContext();
      setContext(nextContext);

      if (options?.launchAfterSave) {
        await launchSelectedWorkSurface(next.workSurfaceMode, nextContext);
      } else {
        setSaveMessage(options?.successMessage ?? 'Settings saved.');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function launchSelectedWorkSurface(
    mode: WorkSurfaceMode,
    nextContext = context
  ): Promise<void> {
    setLaunching(true);
    setSaveMessage(undefined);
    setErrorMessage(undefined);

    try {
      if (!nextContext) {
        throw new Error('Work-surface context is unavailable.');
      }

      if (mode === 'side_panel') {
        const launch = await openSidePanelHost(nextContext);
        if (launch.opened) {
          setSaveMessage('Chrome side panel opened.');
        } else {
          setSaveMessage(
            launch.errorMessage
              ?? 'Mode saved. Use the browser side-panel button if Chrome blocks automatic opening.'
          );
        }
        return;
      }

      if (nextContext.activeTabIsChatGpt) {
        setSaveMessage('Floating panel stays on the current ChatGPT tab.');
        return;
      }

      if (await focusRecentChatGptTab(nextContext)) {
        setSaveMessage('Focused the latest ChatGPT tab. Floating panel will render there.');
        return;
      }

      await openNewChatGptTab();
      setSaveMessage('Opened a new ChatGPT tab for the floating panel.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to launch the selected work surface.');
    } finally {
      setLaunching(false);
    }
  }

  async function focusOrOpenChatGptTab(nextContext = context): Promise<void> {
    setLaunching(true);
    setSaveMessage(undefined);
    setErrorMessage(undefined);

    try {
      if (!nextContext) {
        throw new Error('Work-surface context is unavailable.');
      }

      if (await focusRecentChatGptTab(nextContext)) {
        setSaveMessage('Focused the latest ChatGPT tab.');
        return;
      }

      await openNewChatGptTab();
      setSaveMessage('Opened a new ChatGPT tab.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to open ChatGPT.');
    } finally {
      setLaunching(false);
    }
  }

  async function saveConnectionSettings(): Promise<void> {
    const nextBaseUrl = draftBaseUrl.trim();
    const nextToken = draftToken.trim();
    await persist({
      baseUrl: nextBaseUrl,
      token: nextToken
    }, { successMessage: 'Connection settings saved.' });
    setDraftBaseUrl(nextBaseUrl);
    setDraftToken(nextToken);
    setConnectionDraftDirty(false);
  }

  if (!settings) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f7fffd_0%,#ecfeff_46%,#f8fafc_100%)] p-6 text-slate-950">
        <section className="w-full max-w-md rounded-[28px] border border-teal-100 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <p className="font-mono text-sm text-slate-500">Loading extension console…</p>
          {errorMessage ? <p className="mt-3 text-sm text-rose-700">{errorMessage}</p> : null}
        </section>
      </main>
    );
  }

  const summary = getDisplaySummary(context);
  const statusTone = STATUS_TONE[summary?.status ?? 'idle'] ?? 'bg-slate-100 text-slate-700';
  const activeSectionMeta = OPTIONS_SECTIONS.find((section) => section.id === activeSection)!;
  if (surface === 'popup') {
    return (
      <PopupConsole
        context={context}
        draftBaseUrl={draftBaseUrl}
        draftToken={draftToken}
        errorMessage={errorMessage}
        launching={launching}
        onDraftBaseUrlChange={(value) => {
          setDraftBaseUrl(value);
          setConnectionDraftDirty(true);
        }}
        onDraftTokenChange={(value) => {
          setDraftToken(value);
          setConnectionDraftDirty(true);
        }}
        onOpenChatGpt={() => void focusOrOpenChatGptTab(context)}
        onLaunchSelectedWorkSurface={() => void launchSelectedWorkSurface(settings.workSurfaceMode)}
        onOpenOptions={() => openExtensionOptionsPage()}
        onRefresh={() => void refresh()}
        onSaveBaseUrl={() => void persist({ baseUrl: draftBaseUrl.trim() }, { successMessage: 'Gateway URL saved.' })}
        onSaveToken={() => void persist({ token: draftToken.trim() }, { successMessage: 'Pairing token saved.' })}
        onToggleChange={(field, rawValue) => {
          const value = rawValue === 'inherit' ? 'inherit' : rawValue === 'true';
          void persist({ [field]: value }, { successMessage: `${field} updated.` });
        }}
        onWorkSurfaceModeChange={(mode) => void persist({ workSurfaceMode: mode }, { launchAfterSave: true })}
        popupQuickSettingFields={POPUP_TOGGLE_FIELDS}
        saveMessage={saveMessage}
        saving={saving}
        settings={settings}
        statusTone={statusTone}
        summary={summary}
      />
    );
  }

  return (
    <OptionsConsole
      activeSection={activeSection}
      activeSectionMeta={activeSectionMeta}
      context={context}
      draftBaseUrl={draftBaseUrl}
      draftToken={draftToken}
      errorMessage={errorMessage}
      launching={launching}
      onDraftBaseUrlChange={(value) => {
        setDraftBaseUrl(value);
        setConnectionDraftDirty(true);
      }}
      onDraftTokenChange={(value) => {
        setDraftToken(value);
        setConnectionDraftDirty(true);
      }}
      onLaunchSelectedWorkSurface={() => void launchSelectedWorkSurface(settings.workSurfaceMode)}
      onOpenChatGpt={() => void focusOrOpenChatGptTab(context)}
      onRefresh={() => void refresh()}
      onSaveConnection={(event) => {
        event.preventDefault();
        void saveConnectionSettings();
      }}
      onSectionSelect={setActiveSection}
      onToggleChange={(field, rawValue) => {
        const value = rawValue === 'inherit' ? 'inherit' : rawValue === 'true';
        void persist({ [field]: value }, { successMessage: `${field} updated.` });
      }}
      onWorkSurfaceModeChange={(mode) => void persist({ workSurfaceMode: mode }, { launchAfterSave: true })}
      onRequestInjectionModeChange={(mode) => void persist({ requestInjectionMode: mode }, { successMessage: 'Request injection mode updated.' })}
      onContinueBatchOnErrorChange={(checked) => void persist({ continueBatchOnError: checked }, { successMessage: 'Continue-on-error updated.' })}
      saveMessage={saveMessage}
      saving={saving}
      settings={settings}
      statusTone={statusTone}
      summary={summary}
    />
  );
}

function PopupConsole(props: {
  context: WorkSurfaceContext | null;
  draftBaseUrl: string;
  draftToken: string;
  errorMessage?: string;
  launching: boolean;
  onDraftBaseUrlChange: (value: string) => void;
  onDraftTokenChange: (value: string) => void;
  onOpenChatGpt: () => void;
  onLaunchSelectedWorkSurface: () => void;
  onOpenOptions: () => void;
  onRefresh: () => void;
  onSaveBaseUrl: () => void;
  onSaveToken: () => void;
  onToggleChange: (field: 'autoExecute', rawValue: string) => void;
  onWorkSurfaceModeChange: (mode: WorkSurfaceMode) => void;
  popupQuickSettingFields: typeof POPUP_TOGGLE_FIELDS;
  saveMessage?: string;
  saving: boolean;
  settings: ExtensionSettingsSnapshot;
  statusTone: string;
  summary: ReturnType<typeof getDisplaySummary>;
}) {
  const {
    context,
    draftBaseUrl,
    draftToken,
    errorMessage,
    launching,
    onDraftBaseUrlChange,
    onDraftTokenChange,
    onOpenChatGpt,
    onLaunchSelectedWorkSurface,
    onOpenOptions,
    onRefresh,
    onSaveBaseUrl,
    onSaveToken,
    onToggleChange,
    onWorkSurfaceModeChange,
    popupQuickSettingFields,
    saveMessage,
    saving,
    settings,
    statusTone,
    summary
  } = props;

  return (
    <main className="min-w-[372px] bg-[linear-gradient(180deg,#f7fffd_0%,#ecfeff_42%,#f8fafc_100%)] p-4 text-slate-950">
      <section className="mx-auto w-full max-w-[420px] rounded-[30px] border border-teal-100 bg-white/92 p-4 shadow-[0_28px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <header className="rounded-[24px] border border-teal-100 bg-[linear-gradient(135deg,#0f766e_0%,#115e59_100%)] p-4 text-white shadow-[0_18px_40px_rgba(15,118,110,0.28)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-teal-100">CWMB Launcher</div>
              <h1 className="mt-2 text-[22px] font-semibold leading-tight">Open the selected work surface fast.</h1>
              <p className="mt-2 text-sm leading-6 text-teal-50/90">
                Popup stays intentionally small: status, launch, and four quick settings only.
              </p>
            </div>
            <button
              className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/18 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              onClick={onRefresh}
              type="button"
            >
              Refresh
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone}`}>
              {normalizeSummaryStatus(context)}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-teal-50/95">
              {formatWorkSurfaceMode(settings.workSurfaceMode)}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-teal-50/95">
              {summary?.pendingCount ?? 0} pending
            </span>
          </div>
        </header>

        <section className="mt-4 rounded-[24px] border border-slate-200 bg-slate-950/[0.03] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Launch</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Current target: {formatLaunchTarget(context)}.
              </p>
            </div>
            <button
              className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(249,115,22,0.28)] transition hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={saving || launching}
              onClick={onLaunchSelectedWorkSurface}
              type="button"
            >
              {launching ? 'Opening…' : 'Open selected surface'}
            </button>
          </div>
          <div className="mt-3 grid gap-3">
            <button
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:border-teal-300 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
              onClick={onOpenChatGpt}
              type="button"
            >
              {context?.latestChatGptTabId ? 'Focus latest ChatGPT tab' : 'Open ChatGPT'}
            </button>
            <button
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:border-teal-300 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
              onClick={onOpenOptions}
              type="button"
            >
              Open full options console
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-[24px] border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Quick Settings</h2>
            <span className="font-mono text-xs text-slate-400">4 max</span>
          </div>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-800">Work-surface mode</span>
              <WorkSurfaceModeSwitch
                disabled={saving || launching}
                onChange={onWorkSurfaceModeChange}
                value={settings.workSurfaceMode}
              />
            </label>
            <InlineField
              buttonLabel="Save URL"
              disabled={saving || launching || !draftBaseUrl.trim()}
              label="Gateway base URL"
              onButtonClick={onSaveBaseUrl}
              onValueChange={onDraftBaseUrlChange}
              value={draftBaseUrl}
            />
            <InlineField
              buttonLabel="Save token"
              disabled={saving || launching}
              label="Pairing token"
              onButtonClick={onSaveToken}
              onValueChange={onDraftTokenChange}
              value={draftToken}
            />
            {popupQuickSettingFields.map((field) => (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3" key={field.key}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{field.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{summarizeConfigMode(settings[field.key])}</div>
                  </div>
                  <select
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-teal-500 focus-visible:outline-none"
                    disabled={saving || launching}
                    onChange={(event) => onToggleChange(field.key, event.target.value)}
                    value={String(settings[field.key])}
                  >
                    <option value="inherit">Inherit</option>
                    <option value="true">Force on</option>
                    <option value="false">Force off</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50/85 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Bridge Snapshot</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SummaryCard label="Pending tools" value={String(summary?.pendingCount ?? 0)} />
            <SummaryCard label="Request hook" value={summary?.requestHookStatus ?? 'Unavailable'} />
            <SummaryCard label="Page path" value={summary?.path ?? 'No active ChatGPT conversation'} />
            <SummaryCard label="Last report" value={summary?.updatedAt ? new Date(summary.updatedAt).toLocaleTimeString() : 'No report yet'} />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            {saveMessage ?? 'Popup stays intentionally incomplete. Use options for full editing and diagnostics.'}
          </p>
          {errorMessage ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function OptionsConsole(props: {
  activeSection: OptionsSection;
  activeSectionMeta: { id: OptionsSection; title: string; description: string };
  context: WorkSurfaceContext | null;
  draftBaseUrl: string;
  draftToken: string;
  errorMessage?: string;
  launching: boolean;
  onDraftBaseUrlChange: (value: string) => void;
  onDraftTokenChange: (value: string) => void;
  onLaunchSelectedWorkSurface: () => void;
  onOpenChatGpt: () => void;
  onRefresh: () => void;
  onSaveConnection: (event: FormEvent<HTMLFormElement>) => void;
  onSectionSelect: (section: OptionsSection) => void;
  onToggleChange: (field: 'autoExecute' | 'autoInsert' | 'autoSend', rawValue: string) => void;
  onWorkSurfaceModeChange: (mode: WorkSurfaceMode) => void;
  onRequestInjectionModeChange: (mode: 'synthetic_system' | 'prepend_user') => void;
  onContinueBatchOnErrorChange: (checked: boolean) => void;
  saveMessage?: string;
  saving: boolean;
  settings: ExtensionSettingsSnapshot;
  statusTone: string;
  summary: ReturnType<typeof getDisplaySummary>;
}) {
  const {
    activeSection,
    activeSectionMeta,
    context,
    draftBaseUrl,
    draftToken,
    errorMessage,
    launching,
    onDraftBaseUrlChange,
    onDraftTokenChange,
    onLaunchSelectedWorkSurface,
    onOpenChatGpt,
    onRefresh,
    onSaveConnection,
    onSectionSelect,
    onToggleChange,
    onWorkSurfaceModeChange,
    onRequestInjectionModeChange,
    onContinueBatchOnErrorChange,
    saveMessage,
    saving,
    settings,
    statusTone,
    summary
  } = props;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.14),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.12),transparent_28%),linear-gradient(180deg,#f7fffd_0%,#f8fafc_100%)] p-6 text-slate-950 md:p-10">
      <section className="mx-auto w-full max-w-7xl rounded-[34px] border border-teal-100 bg-white/92 shadow-[0_28px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <header className="grid gap-6 border-b border-slate-200/80 px-6 py-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.28em] text-teal-700">CWMB Control Console</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">One browser-tab home for every durable setting.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Options is the full console. It owns hierarchy, explanations, launch actions, and persisted settings while the ChatGPT page remains the live execution owner.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Bridge state" toneClass={statusTone} value={normalizeSummaryStatus(context)} />
            <MetricCard label="Work surface" value={formatWorkSurfaceMode(settings.workSurfaceMode)} />
            <MetricCard label="Pending tools" value={String(summary?.pendingCount ?? 0)} />
            <MetricCard label="Launch target" value={formatLaunchTarget(context)} />
          </div>
        </header>

        <div className="grid gap-0 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200/80 bg-slate-50/80 p-4 lg:min-h-[760px] lg:border-b-0 lg:border-r lg:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">Sections</div>
              <button
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
                onClick={onRefresh}
                type="button"
              >
                Refresh
              </button>
            </div>
            <nav aria-label="Options sections">
              <div className="space-y-2" aria-orientation="vertical" role="tablist">
                {OPTIONS_SECTIONS.map((section) => {
                  const active = section.id === activeSection;
                  return (
                    <button
                      aria-controls={`cwmb-options-panel-${section.id}`}
                      aria-selected={active}
                      className={`block w-full rounded-2xl px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 ${
                        active
                          ? 'bg-teal-700 text-white shadow-[0_12px_28px_rgba(15,118,110,0.22)]'
                          : 'bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50'
                      }`}
                      id={`cwmb-options-tab-${section.id}`}
                      key={section.id}
                      onClick={() => onSectionSelect(section.id)}
                      role="tab"
                      tabIndex={active ? 0 : -1}
                      type="button"
                    >
                      <div className="text-sm font-semibold">{section.title}</div>
                      <div className={`mt-1 text-xs leading-5 ${active ? 'text-teal-50/85' : 'text-slate-500'}`}>
                        {section.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </nav>
          </aside>

          <section
            aria-labelledby={`cwmb-options-tab-${activeSection}`}
            className="p-5 lg:p-7"
            id={`cwmb-options-panel-${activeSection}`}
            role="tabpanel"
          >
            <header className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0fdfa_100%)] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="font-mono text-xs uppercase tracking-[0.22em] text-teal-700">{activeSectionMeta.title}</div>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">{activeSectionMeta.description}</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(249,115,22,0.24)] transition hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={saving || launching}
                    onClick={onLaunchSelectedWorkSurface}
                    type="button"
                  >
                    {launching ? 'Opening…' : 'Open selected surface'}
                  </button>
                  <button
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
                    disabled={saving || launching}
                    onClick={onOpenChatGpt}
                    type="button"
                  >
                    {context?.latestChatGptTabId ? 'Focus latest ChatGPT tab' : 'Open ChatGPT'}
                  </button>
                </div>
              </div>
              <div className="mt-4 text-sm leading-6 text-slate-600">
                {saveMessage ?? 'Changes apply through one background-owned settings snapshot. Host mode remains editable only from popup and options.'}
              </div>
              {errorMessage ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {errorMessage}
                </div>
              ) : null}
            </header>

            <div className="mt-5 space-y-5">
              {activeSection === 'general' ? (
                <>
                  <PanelCard
                    eyebrow="Surface Hierarchy"
                    title="Choose the one active host, then launch it."
                    description="Floating panel and Chrome side panel expose the same workflow capability set. Only popup and options may change this host rule."
                  >
                    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-800">Selected host mode</span>
                        <WorkSurfaceModeSwitch
                          disabled={saving || launching}
                          onChange={onWorkSurfaceModeChange}
                          value={settings.workSurfaceMode}
                        />
                      </label>
                      <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
                        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal-700">Current rule</div>
                        <div className="mt-2 text-sm leading-6 text-slate-700">
                          Popup is launcher-first. Options is the full console. The work surface itself cannot switch host mode.
                        </div>
                      </div>
                    </div>
                  </PanelCard>
                  <PanelCard
                    eyebrow="Status"
                    title="Active bridge summary"
                    description="This section stays general-first so launch actions and product truth are visible before deeper settings."
                  >
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <SummaryCard label="Bridge state" value={normalizeSummaryStatus(context)} />
                      <SummaryCard label="Pending tools" value={String(summary?.pendingCount ?? 0)} />
                      <SummaryCard label="Page path" value={summary?.path ?? 'No active ChatGPT conversation'} />
                      <SummaryCard label="Request hook" value={summary?.requestHookStatus ?? 'Unavailable'} />
                    </div>
                  </PanelCard>
                </>
              ) : null}

              {activeSection === 'connection' ? (
                <PanelCard
                  eyebrow="Connection"
                  title="Gateway and injection settings"
                  description="These settings shape how the extension reaches the local gateway and prepares hidden prompt injection."
                >
                  <form className="space-y-4" onSubmit={onSaveConnection}>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-800">Gateway base URL</span>
                      <input
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-teal-500 focus-visible:outline-none"
                        onChange={(event) => onDraftBaseUrlChange(event.target.value)}
                        value={draftBaseUrl}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-800">Pairing token</span>
                      <input
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-teal-500 focus-visible:outline-none"
                        onChange={(event) => onDraftTokenChange(event.target.value)}
                        value={draftToken}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-800">Request injection mode</span>
                      <select
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-teal-500 focus-visible:outline-none"
                        disabled={saving || launching}
                        onChange={(event) => onRequestInjectionModeChange(event.target.value === 'prepend_user' ? 'prepend_user' : 'synthetic_system')}
                        value={settings.requestInjectionMode}
                      >
                        <option value="synthetic_system">Synthetic system</option>
                        <option value="prepend_user">Prepend user</option>
                      </select>
                    </label>
                    <div className="flex justify-end">
                      <button
                        className="rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                        disabled={saving || launching}
                        type="submit"
                      >
                        {saving ? 'Saving…' : 'Save connection'}
                      </button>
                    </div>
                  </form>
                </PanelCard>
              ) : null}

              {activeSection === 'automation' ? (
                <PanelCard
                  eyebrow="Automation"
                  title="Background-owned execution preferences"
                  description="These controls stay persisted and should be understandable without opening the live work surface."
                >
                  <div className="space-y-3">
                    {AUTOMATION_FIELDS.map((field) => (
                      <div key={field.key} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-slate-900">{field.label}</div>
                          <div className="mt-1 text-xs text-slate-500">{summarizeConfigMode(settings[field.key])}</div>
                        </div>
                        <select
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-teal-500 focus-visible:outline-none"
                          disabled={saving || launching}
                          onChange={(event) => onToggleChange(field.key, event.target.value)}
                          value={String(settings[field.key])}
                        >
                          <option value="inherit">Inherit</option>
                          <option value="true">Force on</option>
                          <option value="false">Force off</option>
                        </select>
                      </div>
                    ))}
                    <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
                      <div>
                        <div className="font-medium text-slate-900">Continue batch on error</div>
                        <div className="mt-1 text-xs text-slate-500">Keep later calls moving when one batch item fails.</div>
                      </div>
                      <input
                        checked={settings.continueBatchOnError}
                        className="h-4 w-4 accent-teal-700"
                        onChange={(event) => onContinueBatchOnErrorChange(event.target.checked)}
                        type="checkbox"
                      />
                    </label>
                  </div>
                </PanelCard>
              ) : null}

              {activeSection === 'interface' ? (
                <PanelCard
                  eyebrow="Interface"
                  title="Surface hierarchy and host explanations"
                  description="These notes make the current product truth visible to operators instead of hiding it in docs only."
                >
                  <ul className="space-y-3 text-sm leading-6 text-slate-700">
                    <li>Popup stays launcher-first and intentionally incomplete.</li>
                    <li>Options is the full control console with left-nav hierarchy.</li>
                    <li>Floating panel and Chrome side panel share one workflow capability set.</li>
                    <li>The work surface cannot change host mode. Popup and options can.</li>
                    <li>Diagnostics should stay secondary unless runtime severity escalates.</li>
                  </ul>
                </PanelCard>
              ) : null}

              {activeSection === 'diagnostics' ? (
                <>
                  <PanelCard
                    eyebrow="Diagnostics"
                    title="Latest bridge facts"
                    description="This section stays descriptive rather than executable so options does not become a second work surface."
                  >
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <SummaryCard label="Bridge state" value={normalizeSummaryStatus(context)} />
                      <SummaryCard label="Pending tools" value={String(summary?.pendingCount ?? 0)} />
                      <SummaryCard label="Page path" value={summary?.path ?? 'No active ChatGPT conversation'} />
                      <SummaryCard label="Last report" value={summary?.updatedAt ? new Date(summary.updatedAt).toLocaleTimeString() : 'No report yet'} />
                    </div>
                  </PanelCard>
                  <PanelCard
                    eyebrow="Diagnostics"
                    title="Read-model notes"
                    description="The extension shell consumes background settings plus summarized active-tab bridge state."
                  >
                    <ul className="space-y-3 text-sm leading-6 text-slate-700">
                      <li>The floating panel remains the in-page work surface whenever `floating_panel` is selected.</li>
                      <li>The side panel follows the active ChatGPT tab and falls back to an explicit empty state outside ChatGPT.</li>
                      <li>The options surface stays a browser tab, not a popup-sized shell.</li>
                    </ul>
                    {summary?.lastError ? (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {summary.lastError}
                      </div>
                    ) : null}
                    {errorMessage ? (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {errorMessage}
                      </div>
                    ) : null}
                  </PanelCard>
                </>
              ) : null}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function PanelCard({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
      <div className="font-mono text-xs uppercase tracking-[0.22em] text-teal-700">{eyebrow}</div>
      <h3 className="mt-2 text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  toneClass
}: {
  label: string;
  value: string;
  toneClass?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 px-4 py-3 ${toneClass ?? 'bg-white text-slate-900'}`}>
      <div className="text-[11px] uppercase tracking-[0.18em] opacity-75">{label}</div>
      <div className="mt-2 text-sm font-semibold">{value}</div>
    </div>
  );
}

function InlineField({
  buttonLabel,
  disabled,
  label,
  onButtonClick,
  onValueChange,
  value
}: {
  buttonLabel: string;
  disabled: boolean;
  label: string;
  onButtonClick: () => void;
  onValueChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-800">{label}</span>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-teal-500 focus-visible:outline-none"
          onChange={(event) => onValueChange(event.target.value)}
          value={value}
        />
        <button
          className="shrink-0 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800 transition hover:bg-teal-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          disabled={disabled}
          onClick={onButtonClick}
          type="button"
        >
          {buttonLabel}
        </button>
      </div>
    </label>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 break-words font-mono text-sm text-slate-900">{value}</div>
    </div>
  );
}

function WorkSurfaceModeSwitch({
  disabled,
  onChange,
  value
}: {
  disabled: boolean;
  onChange: (mode: WorkSurfaceMode) => void;
  value: WorkSurfaceMode;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-[22px] border border-slate-200 bg-slate-100/80 p-2">
      <ModeButton
        active={value === 'floating_panel'}
        description="In-page draggable host on ChatGPT."
        disabled={disabled}
        label="Floating panel"
        onClick={() => onChange('floating_panel')}
      />
      <ModeButton
        active={value === 'side_panel'}
        description="Browser-native Chrome side panel host."
        disabled={disabled}
        label="Chrome side panel"
        onClick={() => onChange('side_panel')}
      />
    </div>
  );
}

function ModeButton({
  active,
  description,
  disabled,
  label,
  onClick
}: {
  active: boolean;
  description: string;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`rounded-[18px] border px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? 'border-teal-700 bg-teal-700 text-white shadow-[0_12px_28px_rgba(15,118,110,0.18)]'
          : 'border-white bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50'
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <div className="text-sm font-semibold">{label}</div>
      <div className={`mt-1 text-xs leading-5 ${active ? 'text-teal-50/85' : 'text-slate-500'}`}>
        {description}
      </div>
    </button>
  );
}
