import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

const CHATGPT_MATCHES = [
  'https://chatgpt.com/*',
  'https://chat.openai.com/*'
];

export default defineConfig({
  entrypointsDir: 'entrypoints',
  manifestVersion: 3,
  alias: {
    '@cwmb/result-model': '../../packages/result-model/dist/index.js',
    '@cwmb/shared-utils': '../../packages/shared-utils/dist/index.js',
    '@cwmb/tool-contracts': '../../packages/tool-contracts/dist/index.js',
    '@cwmb/turn-model': '../../packages/turn-model/dist/index.js'
  },
  manifest: {
    name: 'ChatGPT Web MCP Bridge',
    description: 'Run the ChatGPT Web MCP Bridge as a Chrome extension.',
    permissions: ['clipboardWrite', 'storage'],
    host_permissions: [
      ...CHATGPT_MATCHES,
      'http://127.0.0.1/*',
      'http://localhost/*'
    ]
  },
  vite: () => ({
    plugins: [
      tailwindcss()
    ]
  })
});
