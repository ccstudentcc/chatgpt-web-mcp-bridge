import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_EXTENSION_SETTINGS, type ActiveTabBridgeSummary } from '../settings/contracts.js';

type MessageListener = (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void;

function createStorageArea(initial: Record<string, unknown> = {}) {
  const store = { ...initial };

  return {
    store,
    api: {
      async get(keys: string | string[]) {
        if (Array.isArray(keys)) {
          return Object.fromEntries(keys.map((key) => [key, store[key]]));
        }

        return { [keys]: store[keys] };
      },
      async set(values: Record<string, unknown>) {
        Object.assign(store, values);
      },
      async remove(keys: string[]) {
        for (const key of keys) {
          delete store[key];
        }
      }
    }
  };
}

async function dispatchMessage(
  listener: MessageListener,
  message: unknown,
  sender: unknown
): Promise<unknown> {
  return new Promise((resolve) => {
    listener(message, sender, (response) => resolve(response));
  });
}

describe('background bridge', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('falls back to the persisted last bridge-tab summary after a service worker restart', async () => {
    const localStorageArea = createStorageArea({
      cwmb_extension_settings: DEFAULT_EXTENSION_SETTINGS
    });
    const sessionStorageArea = createStorageArea();
    const onRemovedListeners: Array<(tabId: number) => void> = [];
    const listeners: MessageListener[] = [];
    let activeTabId = 11;

    const chromeMock = {
      runtime: {
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        onMessage: {
          addListener: vi.fn((listener: MessageListener) => {
            listeners.push(listener);
          })
        }
      },
      tabs: {
        onRemoved: {
          addListener: vi.fn((listener: (tabId: number) => void) => {
            onRemovedListeners.push(listener);
          })
        },
        query: vi.fn(async () => [{ id: activeTabId }])
      },
      storage: {
        local: localStorageArea.api,
        session: sessionStorageArea.api
      }
    };

    vi.stubGlobal('chrome', chromeMock);

    const { startBackgroundBridge } = await import('./background.js');
    const { EXTENSION_MESSAGE_TYPES } = await import('./messages.js');

    startBackgroundBridge();

    const firstListener = listeners.at(-1);
    if (!firstListener) {
      throw new Error('Missing first background listener');
    }

    await dispatchMessage(firstListener, {
      type: EXTENSION_MESSAGE_TYPES.contentScriptReady,
      path: '/c/first',
      hasDomAccess: true
    }, { tab: { id: 11 } });

    const summary: ActiveTabBridgeSummary = {
      path: '/c/first',
      hasDomAccess: true,
      status: 'executing',
      pendingCount: 2,
      requestHookStatus: 'installed',
      updatedAt: 1_000
    };

    await dispatchMessage(firstListener, {
      type: EXTENSION_MESSAGE_TYPES.reportActiveTabSummary,
      summary
    }, { tab: { id: 11 } });

    expect(sessionStorageArea.store.cwmb_last_bridge_tab_id).toBe(11);
    expect(sessionStorageArea.store['cwmb_active_tab_summary:11']).toMatchObject({
      status: 'executing',
      pendingCount: 2
    });

    listeners.length = 0;
    activeTabId = 99;
    vi.resetModules();
    vi.stubGlobal('chrome', chromeMock);

    const restarted = await import('./background.js');
    restarted.startBackgroundBridge();

    const secondListener = listeners.at(-1);
    if (!secondListener) {
      throw new Error('Missing restarted background listener');
    }

    const response = await dispatchMessage(secondListener, {
      type: EXTENSION_MESSAGE_TYPES.getActiveTabSummary
    }, {});

    expect(response).toMatchObject({
      status: 'executing',
      pendingCount: 2,
      path: '/c/first'
    });

    onRemovedListeners.forEach((listener) => listener(11));
    await Promise.resolve();
    await Promise.resolve();
    expect(sessionStorageArea.store['cwmb_active_tab_summary:11']).toBeUndefined();
    expect(sessionStorageArea.store.cwmb_last_bridge_tab_id).toBeUndefined();
    expect(sessionStorageArea.store.cwmb_last_bridge_window_id).toBeUndefined();
  });

  it('reuses an existing options tab before opening a new one', async () => {
    const localStorageArea = createStorageArea({
      cwmb_extension_settings: DEFAULT_EXTENSION_SETTINGS
    });
    const sessionStorageArea = createStorageArea();
    const listeners: MessageListener[] = [];
    const queryTabs = vi.fn(async () => [{ id: 77, windowId: 5 }]);
    const updateTab = vi.fn(async () => undefined);
    const updateWindow = vi.fn(async () => undefined);
    const openOptionsPage = vi.fn(async () => undefined);

    vi.stubGlobal('chrome', {
      runtime: {
        getURL: vi.fn((path: string) => `chrome-extension://test${path}`),
        openOptionsPage,
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        onMessage: {
          addListener: vi.fn((listener: MessageListener) => {
            listeners.push(listener);
          })
        }
      },
      tabs: {
        onRemoved: { addListener: vi.fn() },
        onActivated: { addListener: vi.fn() },
        query: queryTabs,
        update: updateTab
      },
      windows: {
        update: updateWindow
      },
      storage: {
        local: localStorageArea.api,
        session: sessionStorageArea.api
      }
    });

    const { startBackgroundBridge } = await import('./background.js');
    const { EXTENSION_MESSAGE_TYPES } = await import('./messages.js');
    startBackgroundBridge();

    const listener = listeners.at(-1);
    if (!listener) {
      throw new Error('Missing background listener');
    }

    await dispatchMessage(listener, {
      type: EXTENSION_MESSAGE_TYPES.openOptionsPage
    }, {});

    expect(updateTab).toHaveBeenCalledWith(77, { active: true });
    expect(updateWindow).toHaveBeenCalledWith(5, { focused: true });
    expect(openOptionsPage).not.toHaveBeenCalled();
  });

  it('opens the extension options tab directly when none exists yet', async () => {
    const localStorageArea = createStorageArea({
      cwmb_extension_settings: DEFAULT_EXTENSION_SETTINGS
    });
    const sessionStorageArea = createStorageArea();
    const listeners: MessageListener[] = [];
    const createTab = vi.fn(async () => undefined);

    vi.stubGlobal('chrome', {
      runtime: {
        getURL: vi.fn((path: string) => `chrome-extension://test${path}`),
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        onMessage: {
          addListener: vi.fn((listener: MessageListener) => {
            listeners.push(listener);
          })
        }
      },
      tabs: {
        onRemoved: { addListener: vi.fn() },
        onActivated: { addListener: vi.fn() },
        query: vi.fn(async () => []),
        create: createTab
      },
      windows: {},
      storage: {
        local: localStorageArea.api,
        session: sessionStorageArea.api
      }
    });

    const { startBackgroundBridge } = await import('./background.js');
    const { EXTENSION_MESSAGE_TYPES } = await import('./messages.js');
    startBackgroundBridge();

    const listener = listeners.at(-1);
    if (!listener) {
      throw new Error('Missing background listener');
    }

    await dispatchMessage(listener, {
      type: EXTENSION_MESSAGE_TYPES.openOptionsPage
    }, {});

    expect(createTab).toHaveBeenCalledWith({ url: 'chrome-extension://test/options.html' });
  });
});
