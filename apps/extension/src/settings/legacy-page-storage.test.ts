import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearLegacyExtensionSettings,
  isDefaultExtensionSettingsSnapshot,
  readLegacyExtensionSettings
} from './legacy-page-storage.js';
import { DEFAULT_EXTENSION_SETTINGS } from './contracts.js';

describe('legacy page-local settings', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the supported legacy GM values into an extension settings patch', () => {
    const storedValues = new Map<string, string>([
      ['cwmb_token', 'secret-token'],
      ['cwmb_base_url', 'http://127.0.0.1:9123'],
      ['cwmb_auto_execute', 'true'],
      ['cwmb_auto_insert', 'inherit'],
      ['cwmb_auto_send', 'false'],
      ['cwmb_continue_batch_on_error', 'true'],
      ['cwmb_request_injection_mode', 'prepend_user']
    ]);

    vi.stubGlobal('GM_getValue', vi.fn((key: string, defaultValue = '') => storedValues.get(key) ?? defaultValue));

    expect(readLegacyExtensionSettings()).toEqual({
      token: 'secret-token',
      baseUrl: 'http://127.0.0.1:9123',
      autoExecute: true,
      autoInsert: 'inherit',
      autoSend: false,
      continueBatchOnError: true,
      requestInjectionMode: 'prepend_user'
    });
  });

  it('clears the supported legacy GM keys after migration', () => {
    const setValue = vi.fn();
    vi.stubGlobal('GM_setValue', setValue);

    clearLegacyExtensionSettings();

    expect(setValue).toHaveBeenCalledTimes(7);
    expect(setValue).toHaveBeenCalledWith('cwmb_token', '');
    expect(setValue).toHaveBeenCalledWith('cwmb_base_url', '');
    expect(setValue).toHaveBeenCalledWith('cwmb_auto_execute', '');
    expect(setValue).toHaveBeenCalledWith('cwmb_auto_insert', '');
    expect(setValue).toHaveBeenCalledWith('cwmb_auto_send', '');
    expect(setValue).toHaveBeenCalledWith('cwmb_continue_batch_on_error', '');
    expect(setValue).toHaveBeenCalledWith('cwmb_request_injection_mode', '');
  });

  it('recognizes the default snapshot so migration does not overwrite non-default background settings', () => {
    expect(isDefaultExtensionSettingsSnapshot(DEFAULT_EXTENSION_SETTINGS)).toBe(true);
    expect(isDefaultExtensionSettingsSnapshot({
      ...DEFAULT_EXTENSION_SETTINGS,
      baseUrl: 'http://127.0.0.1:9999'
    })).toBe(false);
  });
});
