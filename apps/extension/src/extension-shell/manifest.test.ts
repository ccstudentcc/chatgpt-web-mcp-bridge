import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import type { UserManifest } from 'wxt';

import wxtConfig from '../../wxt.config.js';
import chatgptContentEntrypoint from '../../entrypoints/chatgpt.content.js';
import chatgptMainWorldEntrypoint from '../../entrypoints/chatgpt-main-world.content.js';

describe('manifest', () => {
  it('declares a Phase 2.5-ready MV3 WXT shell', () => {
    const manifest = wxtConfig.manifest as UserManifest;

    expect(wxtConfig.manifestVersion).toBe(3);
    expect(manifest.permissions).toContain('clipboardWrite');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.host_permissions).toContain('https://chatgpt.com/*');
    expect(manifest.host_permissions).toContain('https://chat.openai.com/*');
    expect(chatgptMainWorldEntrypoint.world).toBe('MAIN');
    expect(chatgptContentEntrypoint.matches).toEqual(chatgptMainWorldEntrypoint.matches);
    expect(chatgptContentEntrypoint.runAt).toBe('document_start');
  });

  it('keeps the options surface configured as a browser tab entrypoint', () => {
    const optionsHtml = readFileSync(new URL('../../entrypoints/options/index.html', import.meta.url), 'utf8');

    expect(optionsHtml).toContain('name="wxt.openInTab"');
    expect(optionsHtml).toContain('content="true"');
  });
});
