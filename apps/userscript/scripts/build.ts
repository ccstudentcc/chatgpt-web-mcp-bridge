import { fileURLToPath } from 'node:url';
import { context, build } from 'esbuild';

const packageEntries = {
  '@cwmb/policy-model': fileURLToPath(new URL('../../../packages/policy-model/dist/index.js', import.meta.url)),
  '@cwmb/result-model': fileURLToPath(new URL('../../../packages/result-model/dist/index.js', import.meta.url)),
  '@cwmb/shared-utils': fileURLToPath(new URL('../../../packages/shared-utils/dist/index.js', import.meta.url)),
  '@cwmb/tool-contracts': fileURLToPath(new URL('../../../packages/tool-contracts/dist/index.js', import.meta.url)),
  '@cwmb/turn-model': fileURLToPath(new URL('../../../packages/turn-model/dist/index.js', import.meta.url))
};

const banner = `// ==UserScript==
// @name         ChatGPT Web MCP Bridge
// @namespace    chatgpt-web-mcp-bridge
// @version      0.1.0
// @description  Detect MCP tool calls in ChatGPT Web and bridge them to a local gateway.
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        unsafeWindow
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-start
// ==/UserScript==
`;

const options = {
  entryPoints: ['src/chatgpt-mcp-bridge.user.ts'],
  alias: packageEntries,
  bundle: true,
  format: 'iife' as const,
  platform: 'browser' as const,
  outfile: 'dist/chatgpt-mcp-bridge.user.js',
  banner: { js: banner }
};

if (process.argv.includes('--watch')) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('watching userscript...');
} else {
  await build(options);
}
