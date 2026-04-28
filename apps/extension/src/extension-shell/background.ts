import { PAGE_ORIGIN_HEADER } from '@cwmb/tool-contracts';
import {
  EXTENSION_MESSAGE_TYPES,
  type ContentScriptReadyMessage,
  type GatewayProxyRequestMessage,
  type GetActiveTabSummaryMessage,
  type GetSettingsMessage,
  type PingMessage,
  type ReportActiveTabSummaryMessage,
  type UpdateSettingsMessage
} from './messages.js';
import type { ActiveTabBridgeSummary, ExtensionSettingsSnapshot } from '../settings/contracts.js';
import { readExtensionSettings, writeExtensionSettings } from '../settings/storage.js';

const LOG_PREFIX = '[cwmb extension]';
type GatewayRequestSender = { url?: string; tab?: { url?: string } };
type ExtensionMessage =
  | ContentScriptReadyMessage
  | GatewayProxyRequestMessage
  | GetActiveTabSummaryMessage
  | GetSettingsMessage
  | PingMessage
  | ReportActiveTabSummaryMessage
  | UpdateSettingsMessage;

const activeTabSummaries = new Map<number, ActiveTabBridgeSummary>();
let backgroundBridgeInstalled = false;
const SUMMARY_KEY_PREFIX = 'cwmb_active_tab_summary:';
const LAST_BRIDGE_TAB_ID_KEY = 'cwmb_last_bridge_tab_id';

export function startBackgroundBridge(): void {
  if (backgroundBridgeInstalled) {
    return;
  }

  backgroundBridgeInstalled = true;

  chrome.runtime.onInstalled.addListener(() => {
    console.log(`${LOG_PREFIX} service worker installed`);
  });

  chrome.runtime.onStartup.addListener(() => {
    console.log(`${LOG_PREFIX} service worker startup`);
  });

  chrome.tabs?.onRemoved?.addListener((tabId: number) => {
    activeTabSummaries.delete(tabId);
    void chrome.storage.session.remove([getSummaryStorageKey(tabId)]);
  });

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender: any, sendResponse: (response: unknown) => void) => {
    if (!message || typeof message !== 'object' || !('type' in message)) {
      return false;
    }

    if (message.type === EXTENSION_MESSAGE_TYPES.ping) {
      console.log(`${LOG_PREFIX} lifecycle ping from content script`);
      sendResponse({ ok: true, receivedAt: Date.now() });
      return false;
    }

    if (message.type === EXTENSION_MESSAGE_TYPES.contentScriptReady) {
      if (typeof sender?.tab?.id === 'number') {
        const previous = activeTabSummaries.get(sender.tab.id);
        const summary = {
          path: message.path,
          hasDomAccess: message.hasDomAccess,
          status: previous?.status ?? 'idle',
          pendingCount: previous?.pendingCount ?? 0,
          lastError: previous?.lastError,
          requestHookStatus: previous?.requestHookStatus,
          requestPromptSource: previous?.requestPromptSource,
          catalogSource: previous?.catalogSource,
          catalogVersion: previous?.catalogVersion,
          updatedAt: Date.now()
        } satisfies ActiveTabBridgeSummary;
        activeTabSummaries.set(sender.tab.id, summary);
        void persistActiveTabSummary(sender.tab.id, summary);
      }

      console.log(`${LOG_PREFIX} content script ready`, {
        path: message.path,
        hasDomAccess: message.hasDomAccess,
        tabId: sender?.tab?.id
      });
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === EXTENSION_MESSAGE_TYPES.getSettings) {
      void readExtensionSettings().then((settings) => sendResponse(settings));
      return true;
    }

    if (message.type === EXTENSION_MESSAGE_TYPES.updateSettings) {
      void writeExtensionSettings(message.patch)
        .then((settings) => sendResponse(settings))
        .catch((error: unknown) => {
          sendResponse({
            error: error instanceof Error ? error.message : 'Failed to update settings'
          });
        });
      return true;
    }

    if (message.type === EXTENSION_MESSAGE_TYPES.getActiveTabSummary) {
      void getActiveTabSummary().then((summary) => sendResponse(summary));
      return true;
    }

    if (message.type === EXTENSION_MESSAGE_TYPES.reportActiveTabSummary) {
      if (typeof sender?.tab?.id === 'number') {
        const summary = {
          ...message.summary,
          updatedAt: Date.now()
        };
        activeTabSummaries.set(sender.tab.id, summary);
        void persistActiveTabSummary(sender.tab.id, summary);
      }
      sendResponse(undefined);
      return false;
    }

    if (message.type === EXTENSION_MESSAGE_TYPES.gatewayRequest) {
      void proxyGatewayRequest(message, sender)
        .then((response) => sendResponse(response))
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : 'Gateway proxy failed'
          });
        });
      return true;
    }

    return false;
  });
}

async function getActiveTabSummary(): Promise<ActiveTabBridgeSummary | null> {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (typeof activeTab?.id === 'number') {
    const activeSummary = await readPersistedActiveTabSummary(activeTab.id);
    if (activeSummary) {
      return activeSummary;
    }
  }

  const stored = await chrome.storage.session.get(LAST_BRIDGE_TAB_ID_KEY);
  const lastBridgeTabId = stored[LAST_BRIDGE_TAB_ID_KEY];

  if (typeof lastBridgeTabId !== 'number') {
    return null;
  }

  return readPersistedActiveTabSummary(lastBridgeTabId);
}

function getSummaryStorageKey(tabId: number): string {
  return `${SUMMARY_KEY_PREFIX}${tabId}`;
}

async function persistActiveTabSummary(tabId: number, summary: ActiveTabBridgeSummary): Promise<void> {
  await chrome.storage.session.set({
    [LAST_BRIDGE_TAB_ID_KEY]: tabId,
    [getSummaryStorageKey(tabId)]: summary
  });
}

async function readPersistedActiveTabSummary(tabId: number): Promise<ActiveTabBridgeSummary | null> {
  const inMemory = activeTabSummaries.get(tabId);
  if (inMemory) {
    return inMemory;
  }

  const stored = await chrome.storage.session.get(getSummaryStorageKey(tabId));
  const summary = stored[getSummaryStorageKey(tabId)];

  if (!summary || typeof summary !== 'object') {
    return null;
  }

  const persisted = summary as ActiveTabBridgeSummary;
  activeTabSummaries.set(tabId, persisted);
  return persisted;
}

async function proxyGatewayRequest(message: GatewayProxyRequestMessage, sender: GatewayRequestSender): Promise<unknown> {
  const controller = new AbortController();
  const timeoutMs = typeof message.request.timeout === 'number' ? message.request.timeout : 15_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const pageOrigin = resolveChatGptPageOrigin(sender);
  const headers = { ...(message.request.headers ?? {}) };

  if (pageOrigin) {
    headers[PAGE_ORIGIN_HEADER] = pageOrigin;
  }

  try {
    const response = await fetch(message.request.url, {
      method: message.request.method,
      body: message.request.data,
      headers,
      signal: controller.signal
    });
    const responseText = await response.text();
    return {
      ok: true,
      status: response.status,
      responseText
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        ok: false,
        timedOut: true
      };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Gateway request failed'
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function resolveChatGptPageOrigin(sender: GatewayRequestSender): string | undefined {
  const candidate = sender.url ?? sender.tab?.url;
  if (!candidate) {
    return undefined;
  }

  try {
    const url = new URL(candidate);
    if (url.origin === 'https://chatgpt.com' || url.origin === 'https://chat.openai.com') {
      return url.origin;
    }
  } catch {
    return undefined;
  }

  return undefined;
}
