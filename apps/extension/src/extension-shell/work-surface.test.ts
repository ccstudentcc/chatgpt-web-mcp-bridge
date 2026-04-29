import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  focusRecentChatGptTab,
  openSidePanelHost,
  syncWorkSurfaceHostMode
} from './work-surface.js';

describe('work-surface host orchestration', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('disables the sidepanel and closes the current window in floating-panel mode', async () => {
    const setOptions = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    vi.stubGlobal('chrome', {
      sidePanel: {
        setOptions,
        close,
        open: vi.fn(async () => undefined)
      }
    });

    await syncWorkSurfaceHostMode('floating_panel', {
      activeTabId: 7,
      activeWindowId: 3,
      latestChatGptTabId: 8
    });

    expect(setOptions).toHaveBeenCalledWith({
      tabId: 7,
      enabled: false
    });
    expect(setOptions).toHaveBeenCalledWith({
      tabId: 8,
      enabled: false
    });
    expect(close).toHaveBeenCalledWith({ windowId: 3 });
  });

  it('enables the sidepanel path for relevant tabs in side-panel mode', async () => {
    const setOptions = vi.fn(async () => undefined);
    vi.stubGlobal('chrome', {
      sidePanel: {
        setOptions,
        open: vi.fn(async () => undefined)
      }
    });

    await syncWorkSurfaceHostMode('side_panel', {
      activeTabId: 11,
      activeWindowId: 4,
      latestChatGptTabId: 11
    });

    expect(setOptions).toHaveBeenCalledTimes(1);
    expect(setOptions).toHaveBeenCalledWith({
      tabId: 11,
      enabled: true,
      path: '/sidepanel.html'
    });
  });

  it('opens the sidepanel against the active tab when available', async () => {
    const setOptions = vi.fn(async () => undefined);
    const open = vi.fn(async () => undefined);
    vi.stubGlobal('chrome', {
      sidePanel: {
        setOptions,
        open
      }
    });

    await expect(openSidePanelHost({
      activeTabId: 23,
      activeWindowId: 5
    })).resolves.toMatchObject({
      opened: true
    });

    expect(setOptions).toHaveBeenCalledWith({
      tabId: 23,
      enabled: true,
      path: '/sidepanel.html'
    });
    expect(open).toHaveBeenCalledWith({ tabId: 23 });
  });

  it('focuses the latest ChatGPT tab when one is known', async () => {
    const updateTab = vi.fn(async () => undefined);
    const updateWindow = vi.fn(async () => undefined);
    vi.stubGlobal('chrome', {
      tabs: {
        update: updateTab
      },
      windows: {
        update: updateWindow
      }
    });

    await expect(focusRecentChatGptTab({
      latestChatGptTabId: 41,
      latestChatGptWindowId: 9
    })).resolves.toBe(true);

    expect(updateTab).toHaveBeenCalledWith(41, { active: true });
    expect(updateWindow).toHaveBeenCalledWith(9, { focused: true });
  });
});
