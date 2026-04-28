import {
  DEFAULT_EXTENSION_SETTINGS,
  type BooleanSettingOverride,
  type ExtensionSettingsPatch,
  type ExtensionSettingsSnapshot
} from './contracts.js';

const LEGACY_KEYS = {
  token: 'cwmb_token',
  baseUrl: 'cwmb_base_url',
  autoExecute: 'cwmb_auto_execute',
  autoInsert: 'cwmb_auto_insert',
  autoSend: 'cwmb_auto_send',
  continueBatchOnError: 'cwmb_continue_batch_on_error',
  requestInjectionMode: 'cwmb_request_injection_mode'
} as const;

function readBooleanOverride(key: keyof Pick<typeof LEGACY_KEYS, 'autoExecute' | 'autoInsert' | 'autoSend'>): BooleanSettingOverride | undefined {
  const raw = GM_getValue(LEGACY_KEYS[key], '');

  if (raw === 'inherit') {
    return 'inherit';
  }

  if (raw === 'true') {
    return true;
  }

  if (raw === 'false') {
    return false;
  }

  return undefined;
}

export function readLegacyExtensionSettings(): ExtensionSettingsPatch | null {
  const patch: ExtensionSettingsPatch = {};
  const token = GM_getValue(LEGACY_KEYS.token, '');
  const baseUrl = GM_getValue(LEGACY_KEYS.baseUrl, '');
  const autoExecute = readBooleanOverride('autoExecute');
  const autoInsert = readBooleanOverride('autoInsert');
  const autoSend = readBooleanOverride('autoSend');
  const continueBatchOnError = GM_getValue(LEGACY_KEYS.continueBatchOnError, '');
  const requestInjectionMode = GM_getValue(LEGACY_KEYS.requestInjectionMode, '');

  if (token) {
    patch.token = token;
  }
  if (baseUrl) {
    patch.baseUrl = baseUrl;
  }
  if (autoExecute !== undefined) {
    patch.autoExecute = autoExecute;
  }
  if (autoInsert !== undefined) {
    patch.autoInsert = autoInsert;
  }
  if (autoSend !== undefined) {
    patch.autoSend = autoSend;
  }
  if (continueBatchOnError === 'true') {
    patch.continueBatchOnError = true;
  }
  if (requestInjectionMode === 'prepend_user' || requestInjectionMode === 'synthetic_system') {
    patch.requestInjectionMode = requestInjectionMode;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export function clearLegacyExtensionSettings(): void {
  for (const key of Object.values(LEGACY_KEYS)) {
    GM_setValue(key, '');
  }
}

export function isDefaultExtensionSettingsSnapshot(settings: ExtensionSettingsSnapshot): boolean {
  return settings.token === DEFAULT_EXTENSION_SETTINGS.token
    && settings.baseUrl === DEFAULT_EXTENSION_SETTINGS.baseUrl
    && settings.autoExecute === DEFAULT_EXTENSION_SETTINGS.autoExecute
    && settings.autoInsert === DEFAULT_EXTENSION_SETTINGS.autoInsert
    && settings.autoSend === DEFAULT_EXTENSION_SETTINGS.autoSend
    && settings.continueBatchOnError === DEFAULT_EXTENSION_SETTINGS.continueBatchOnError
    && settings.requestInjectionMode === DEFAULT_EXTENSION_SETTINGS.requestInjectionMode;
}
