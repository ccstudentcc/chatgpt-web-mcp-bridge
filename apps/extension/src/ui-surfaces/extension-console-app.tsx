import { useEffect, useState } from 'react';

import {
  getActiveTabBridgeSummary,
  getExtensionSettings,
  updateExtensionSettings
} from '../settings/runtime-client.js';
import type {
  ActiveTabBridgeSummary,
  BooleanSettingOverride,
  ExtensionSettingsSnapshot
} from '../settings/contracts.js';

type Surface = 'popup' | 'options';

const TOGGLE_FIELDS = [
  { key: 'autoExecute' as const, label: 'Auto execute low-risk calls' },
  { key: 'autoInsert' as const, label: 'Auto insert results' },
  { key: 'autoSend' as const, label: 'Auto send inserted results' }
];

const STATUS_TONE: Record<string, string> = {
  disconnected: 'text-rose-700 bg-rose-100',
  unauthorized: 'text-amber-700 bg-amber-100',
  idle: 'text-sky-700 bg-sky-100',
  detected: 'text-indigo-700 bg-indigo-100',
  detected_batch: 'text-indigo-700 bg-indigo-100',
  executing: 'text-emerald-700 bg-emerald-100',
  batch_executing: 'text-emerald-700 bg-emerald-100',
  invalid_mcp_turn: 'text-orange-700 bg-orange-100',
  failed: 'text-rose-700 bg-rose-100'
};

function normalizeSummaryStatus(summary: ActiveTabBridgeSummary | null): string {
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

export function ExtensionConsoleApp({ surface }: { surface: Surface }) {
  const [settings, setSettings] = useState<ExtensionSettingsSnapshot | null>(null);
  const [summary, setSummary] = useState<ActiveTabBridgeSummary | null>(null);
  const [draftBaseUrl, setDraftBaseUrl] = useState('');
  const [draftToken, setDraftToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(): Promise<void> {
    try {
      const [nextSettings, nextSummary] = await Promise.all([
        getExtensionSettings(),
        getActiveTabBridgeSummary()
      ]);
      setSettings(nextSettings);
      setSummary(nextSummary);
      setDraftBaseUrl(nextSettings.baseUrl);
      setDraftToken(nextSettings.token);
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load extension state.');
    }
  }

  async function persist(patch: Partial<ExtensionSettingsSnapshot>): Promise<void> {
    setSaving(true);
    setSaveMessage(undefined);
    setErrorMessage(undefined);

    try {
      const next = await updateExtensionSettings(patch);
      setSettings(next);
      setDraftBaseUrl(next.baseUrl);
      setDraftToken(next.token);
      setSaveMessage('Settings saved');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <section className="w-full max-w-md rounded-[28px] border border-white/60 bg-white/75 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <p className="font-mono text-sm text-slate-500">Loading extension console…</p>
          {errorMessage ? <p className="mt-3 text-sm text-rose-700">{errorMessage}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className={surface === 'popup' ? 'min-w-[360px] p-4' : 'min-h-screen p-6 md:p-10'}>
      <section className="mx-auto w-full max-w-5xl rounded-[28px] border border-white/70 bg-white/78 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl md:p-8">
        <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.28em] text-sky-700">CWMB Extension</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">
              {surface === 'popup' ? 'Bridge Snapshot' : 'Extension Control Console'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {surface === 'popup'
                ? 'Quick status, quick toggles, and a fast path into the full control surface.'
                : 'Background-owned settings live here. Page runtime remains the execution surface on ChatGPT.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_TONE[summary?.status ?? 'idle'] ?? 'text-slate-700 bg-slate-100'}`}>
              {normalizeSummaryStatus(summary)}
            </span>
            <button
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
              onClick={() => void refresh()}
              type="button"
            >
              Refresh
            </button>
            {surface === 'popup' ? (
              <button
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
                onClick={() => chrome.runtime.openOptionsPage()}
                type="button"
              >
                Open options
              </button>
            ) : null}
          </div>
        </header>

        <div className={`mt-6 grid gap-4 ${surface === 'popup' ? '' : 'lg:grid-cols-[1.1fr_0.9fr]'}`}>
          <section className="space-y-4">
            <div className="rounded-[24px] border border-white/70 bg-slate-950/[0.03] p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Active tab</h2>
                <span className="font-mono text-xs text-slate-500">
                  {summary?.updatedAt ? new Date(summary.updatedAt).toLocaleTimeString() : 'No report yet'}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <SummaryCard label="Bridge state" value={normalizeSummaryStatus(summary)} />
                <SummaryCard label="Pending tools" value={String(summary?.pendingCount ?? 0)} />
                <SummaryCard label="Page path" value={summary?.path ?? 'No active ChatGPT conversation'} />
                <SummaryCard label="Request hook" value={summary?.requestHookStatus ?? 'Unavailable'} />
              </div>
              {summary?.lastError ? (
                <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {summary.lastError}
                </p>
              ) : null}
            </div>

            <div className="rounded-[24px] border border-white/70 bg-white/80 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Automation profile</h2>
                <span className="font-mono text-xs text-slate-500">Background-owned</span>
              </div>
              <div className="mt-4 space-y-3">
                {TOGGLE_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{field.label}</div>
                      <div className="text-xs text-slate-500">{summarizeConfigMode(settings[field.key])}</div>
                    </div>
                    <select
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                      disabled={saving}
                      onChange={(event) => {
                        const value = event.target.value;
                        void persist({
                          [field.key]: value === 'inherit' ? 'inherit' : value === 'true'
                        });
                      }}
                      value={String(settings[field.key])}
                    >
                      <option value="inherit">Inherit</option>
                      <option value="true">Force on</option>
                      <option value="false">Force off</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <form
              className="rounded-[24px] border border-white/70 bg-white/80 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void persist({
                  baseUrl: draftBaseUrl.trim(),
                  token: draftToken.trim()
                });
              }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Gateway settings</h2>
                <span className="font-mono text-xs text-slate-500">{settings.requestInjectionMode}</span>
              </div>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Gateway base URL</span>
                  <input
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500"
                    onChange={(event) => setDraftBaseUrl(event.target.value)}
                    value={draftBaseUrl}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Pairing token</span>
                  <input
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500"
                    onChange={(event) => setDraftToken(event.target.value)}
                    value={draftToken}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Request injection mode</span>
                  <select
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500"
                    disabled={saving}
                    onChange={(event) => void persist({ requestInjectionMode: event.target.value === 'prepend_user' ? 'prepend_user' : 'synthetic_system' })}
                    value={settings.requestInjectionMode}
                  >
                    <option value="synthetic_system">Synthetic system</option>
                    <option value="prepend_user">Prepend user</option>
                  </select>
                </label>
                <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
                  <span>Continue batch on error</span>
                  <input
                    checked={settings.continueBatchOnError}
                    className="h-4 w-4 accent-sky-600"
                    onChange={(event) => void persist({ continueBatchOnError: event.target.checked })}
                    type="checkbox"
                  />
                </label>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <div className="text-sm text-slate-500">
                  {saveMessage ?? 'Changes apply to the in-page panel, popup, and options through one background-owned snapshot.'}
                </div>
                <button
                  className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={saving}
                  type="submit"
                >
                  {saving ? 'Saving…' : 'Save settings'}
                </button>
              </div>
            </form>

            <div className="rounded-[24px] border border-white/70 bg-slate-950/[0.03] p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Read-model notes</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li>Popup and options only consume background settings plus summarized active-tab bridge state.</li>
                <li>The ChatGPT in-page panel remains the primary execution surface for run, insert, send, and recovery flows.</li>
                <li>Conversation-local diagnostics stay page-owned; this console only mirrors a safe summary.</li>
              </ul>
            </div>
            {errorMessage ? (
              <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 break-words font-mono text-sm text-slate-900">{value}</div>
    </div>
  );
}
