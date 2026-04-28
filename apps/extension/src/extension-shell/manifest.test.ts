import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('manifest', () => {
  it('declares a Stage 19-ready MV3 extension shell', () => {
    const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../../manifest.json', import.meta.url)), 'utf8')) as {
      manifest_version: number;
      background?: { service_worker?: string };
      content_scripts?: Array<{ world?: string }>;
    };
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background?.service_worker).toBe('background.js');
    expect(manifest.content_scripts).toHaveLength(2);
    expect(manifest.content_scripts?.[0]?.world).toBe('MAIN');
  });
});
