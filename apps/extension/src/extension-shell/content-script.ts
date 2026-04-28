import { startExtensionRuntimeWhenReady } from '../main/index.js';
import { EXTENSION_MESSAGE_TYPES, type ContentScriptReadyMessage, type PingMessage } from './messages.js';

const PANEL_HOST_ID = 'cwmb-extension-panel-host';

const pingMessage: PingMessage = {
  type: EXTENSION_MESSAGE_TYPES.ping,
  source: 'content-script'
};

chrome.runtime.sendMessage(pingMessage);
chrome.runtime.sendMessage({
  type: EXTENSION_MESSAGE_TYPES.contentScriptReady,
  path: window.location.pathname,
  hasDomAccess: Boolean(document.documentElement)
} satisfies ContentScriptReadyMessage);

startExtensionRuntimeWhenReady({
  installRequestHook: false,
  panelMountTarget: ensurePanelShadowRoot()
});

function ensurePanelShadowRoot(): ShadowRoot {
  let host = document.getElementById(PANEL_HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = PANEL_HOST_ID;
    (document.documentElement || document.head).appendChild(host);
  }

  return host.shadowRoot ?? host.attachShadow({ mode: 'open' });
}
