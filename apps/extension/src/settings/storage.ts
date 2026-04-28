import {
  DEFAULT_EXTENSION_SETTINGS,
  type BooleanSettingOverride,
  type ExtensionSettingsPatch,
  type ExtensionSettingsSnapshot
} from './contracts.js';

const STORAGE_KEY = 'cwmb_extension_settings';

function normalizeBooleanSettingOverride(value: unknown, fallback: BooleanSettingOverride): BooleanSettingOverride {
  if (value === 'inherit' || typeof value === 'boolean') {
    return value;
  }

  return fallback;
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeExtensionSettings(value: unknown): ExtensionSettingsSnapshot {
  const candidate = value && typeof value === 'object' ? value as Partial<ExtensionSettingsSnapshot> : {};

  return {
    token: normalizeString(candidate.token, DEFAULT_EXTENSION_SETTINGS.token),
    baseUrl: normalizeString(candidate.baseUrl, DEFAULT_EXTENSION_SETTINGS.baseUrl),
    autoExecute: normalizeBooleanSettingOverride(candidate.autoExecute, DEFAULT_EXTENSION_SETTINGS.autoExecute),
    autoInsert: normalizeBooleanSettingOverride(candidate.autoInsert, DEFAULT_EXTENSION_SETTINGS.autoInsert),
    autoSend: normalizeBooleanSettingOverride(candidate.autoSend, DEFAULT_EXTENSION_SETTINGS.autoSend),
    continueBatchOnError: normalizeBoolean(
      candidate.continueBatchOnError,
      DEFAULT_EXTENSION_SETTINGS.continueBatchOnError
    ),
    requestInjectionMode: candidate.requestInjectionMode === 'prepend_user'
      ? 'prepend_user'
      : DEFAULT_EXTENSION_SETTINGS.requestInjectionMode
  };
}

export async function readExtensionSettings(): Promise<ExtensionSettingsSnapshot> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeExtensionSettings(stored[STORAGE_KEY]);
}

export async function writeExtensionSettings(patch: ExtensionSettingsPatch): Promise<ExtensionSettingsSnapshot> {
  const current = await readExtensionSettings();
  const next = normalizeExtensionSettings({
    ...current,
    ...patch
  });

  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}
