import { useEffect, useState } from 'react';

import {
  focusRecentChatGptTab,
  openNewChatGptTab,
  type WorkSurfaceContext
} from '../extension-shell/work-surface.js';
import { getExtensionSettings, getWorkSurfaceContext } from '../settings/runtime-client.js';
import type { ExtensionSettingsSnapshot } from '../settings/contracts.js';
import { deriveSidepanelSurfaceState } from './sidepanel-surface-state.js';

export function SidepanelSurfaceApp() {
  const [settings, setSettings] = useState<ExtensionSettingsSnapshot | null>(null);
  const [context, setContext] = useState<WorkSurfaceContext | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>();

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
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load sidepanel state.');
    }
  }

  async function refreshContext(): Promise<void> {
    try {
      setContext(await getWorkSurfaceContext());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to refresh sidepanel context.');
    }
  }

  if (!settings) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <section className="w-full max-w-xl rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <p className="font-mono text-sm text-slate-500">Loading sidepanel host…</p>
          {errorMessage ? <p className="mt-3 text-sm text-rose-700">{errorMessage}</p> : null}
        </section>
      </main>
    );
  }

  const view = deriveSidepanelSurfaceState(settings.workSurfaceMode, context);
  const summary = context?.activeSummary ?? context?.latestSummary ?? null;

  return (
    <main className="min-h-screen bg-slate-100 p-5">
      <section className="mx-auto w-full max-w-3xl rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] md:p-8">
        <header className="border-b border-slate-200/80 pb-5">
          <div className="font-mono text-xs uppercase tracking-[0.28em] text-sky-700">CWMB Side Panel</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">{view.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{view.description}</p>
        </header>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card label="Selected mode" value={settings.workSurfaceMode === 'side_panel' ? 'Chrome side panel' : 'Floating panel'} />
          <Card label="Latest ChatGPT path" value={view.latestPath} />
          <Card label="Bridge state" value={summary?.status?.replaceAll('_', ' ') ?? 'No live summary'} />
          <Card label="Pending tools" value={String(summary?.pendingCount ?? 0)} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {view.primaryAction === 'focus_latest_chatgpt' ? (
            <button
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
              onClick={() => void focusRecentChatGptTab(context ?? {})}
              type="button"
            >
              Focus latest ChatGPT tab
            </button>
          ) : null}
          {view.primaryAction === 'open_new_chatgpt' ? (
            <button
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
              onClick={() => void openNewChatGptTab()}
              type="button"
            >
              Open ChatGPT
            </button>
          ) : null}
          <button
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
            onClick={() => chrome.runtime.openOptionsPage()}
            type="button"
          >
            Open options tab
          </button>
          <button
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
            onClick={() => void refresh()}
            type="button"
          >
            Refresh
          </button>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 break-words font-mono text-sm text-slate-900">{value}</div>
    </div>
  );
}
