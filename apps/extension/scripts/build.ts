import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build, context } from 'esbuild';

const packageEntries = {
  '@cwmb/result-model': fileURLToPath(new URL('../../../packages/result-model/dist/index.js', import.meta.url)),
  '@cwmb/shared-utils': fileURLToPath(new URL('../../../packages/shared-utils/dist/index.js', import.meta.url)),
  '@cwmb/tool-contracts': fileURLToPath(new URL('../../../packages/tool-contracts/dist/index.js', import.meta.url)),
  '@cwmb/turn-model': fileURLToPath(new URL('../../../packages/turn-model/dist/index.js', import.meta.url))
};

const entryPoints = {
  background: 'src/extension-shell/background.ts',
  'content-script': 'src/extension-shell/content-script.ts',
  'gm-shim': 'src/extension-shell/gm-shim.ts',
  'page-hook': 'src/extension-shell/page-hook.ts'
};

async function copyManifest(): Promise<void> {
  await mkdir('dist', { recursive: true });
  await copyFile('manifest.json', 'dist/manifest.json');
}

const options = {
  entryPoints,
  alias: packageEntries,
  bundle: true,
  format: 'iife' as const,
  platform: 'browser' as const,
  outdir: 'dist',
  entryNames: '[name]'
};

if (process.argv.includes('--watch')) {
  await copyManifest();
  const ctx = await context(options);
  await ctx.watch();
  console.log('watching extension...');
} else {
  await build(options);
  await copyManifest();
}
