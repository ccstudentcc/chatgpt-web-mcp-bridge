import { describe, expect, it } from 'vitest';

import { DEFAULT_EXTENSION_SETTINGS } from './contracts.js';
import { normalizeExtensionSettings } from './storage.js';

describe('normalizeExtensionSettings', () => {
  it('defaults the work-surface mode to floating_panel', () => {
    expect(normalizeExtensionSettings({})).toMatchObject({
      workSurfaceMode: DEFAULT_EXTENSION_SETTINGS.workSurfaceMode
    });
  });

  it('accepts the persisted side_panel mode', () => {
    expect(normalizeExtensionSettings({
      workSurfaceMode: 'side_panel'
    }).workSurfaceMode).toBe('side_panel');
  });

  it('rejects unsupported work-surface modes', () => {
    expect(normalizeExtensionSettings({
      workSurfaceMode: 'unsupported_mode'
    }).workSurfaceMode).toBe(DEFAULT_EXTENSION_SETTINGS.workSurfaceMode);
  });
});
