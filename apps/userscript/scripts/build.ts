import { context, build } from 'esbuild';

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
