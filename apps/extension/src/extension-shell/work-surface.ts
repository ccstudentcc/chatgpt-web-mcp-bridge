import type { ActiveTabBridgeSummary, WorkSurfaceMode } from '../settings/contracts.js';

const CHATGPT_ORIGINS = new Set([
  'https://chatgpt.com',
  'https://chat.openai.com'
]);

export const SIDEPANEL_PATH = '/sidepanel.html';

export interface WorkSurfaceContext {
  activeTabId?: number;
  activeWindowId?: number;
  activeTabIsChatGpt: boolean;
  activeSummary: ActiveTabBridgeSummary | null;
  latestSummary: ActiveTabBridgeSummary | null;
  latestChatGptTabId?: number;
  latestChatGptWindowId?: number;
}

export interface SidePanelLaunchResult {
  opened: boolean;
  errorMessage?: string;
}

type SidePanelApi = {
  close?: (options: { windowId: number }) => Promise<void>;
  open: (options: { tabId?: number; windowId?: number }) => Promise<void>;
  setOptions: (options: { tabId: number; enabled: boolean; path?: string }) => Promise<void>;
};

function getSidePanelApi(): SidePanelApi | null {
  const candidate = chrome?.sidePanel;
  if (!candidate || typeof candidate.open !== 'function' || typeof candidate.setOptions !== 'function') {
    return null;
  }

  return candidate as SidePanelApi;
}

export function isChatGptUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  try {
    return CHATGPT_ORIGINS.has(new URL(url).origin);
  } catch {
    return false;
  }
}

export async function syncWorkSurfaceHostMode(
  mode: WorkSurfaceMode,
  context: Pick<WorkSurfaceContext, 'activeTabId' | 'activeWindowId' | 'latestChatGptTabId'>
): Promise<void> {
  const sidePanel = getSidePanelApi();

  if (!sidePanel) {
    return;
  }

  const relevantTabIds = [...new Set([
    context.activeTabId,
    context.latestChatGptTabId
  ])].filter((value): value is number => typeof value === 'number');

  if (mode === 'side_panel') {
    await Promise.all(relevantTabIds.map((tabId) => (
      sidePanel.setOptions({
        tabId,
        enabled: true,
        path: SIDEPANEL_PATH
      })
    )));
    return;
  }

  await Promise.all(relevantTabIds.map((tabId) => (
    sidePanel.setOptions({
      tabId,
      enabled: false
    })
  )));

  if (typeof context.activeWindowId === 'number' && typeof sidePanel.close === 'function') {
    try {
      await sidePanel.close({ windowId: context.activeWindowId });
    } catch {
      // Best-effort close only. The sidepanel surface also guards itself against stale mode.
    }
  }
}

export async function openSidePanelHost(
  context: Pick<WorkSurfaceContext, 'activeTabId' | 'activeWindowId'>
): Promise<SidePanelLaunchResult> {
  const sidePanel = getSidePanelApi();
  if (!sidePanel) {
    return {
      opened: false,
      errorMessage: 'Chrome side panel API is unavailable in this browser runtime.'
    };
  }

  if (typeof context.activeTabId === 'number') {
    await sidePanel.setOptions({
      tabId: context.activeTabId,
      enabled: true,
      path: SIDEPANEL_PATH
    });
  }

  if (typeof context.activeTabId !== 'number' && typeof context.activeWindowId !== 'number') {
    return {
      opened: false,
      errorMessage: 'No active browser window is available for the side panel.'
    };
  }

  try {
    if (typeof context.activeTabId === 'number') {
      await sidePanel.open({ tabId: context.activeTabId });
    } else {
      await sidePanel.open({ windowId: context.activeWindowId });
    }

    return { opened: true };
  } catch (error) {
    return {
      opened: false,
      errorMessage: error instanceof Error
        ? error.message
        : 'Chrome blocked automatic side-panel opening. Use the browser side-panel button to continue.'
    };
  }
}

export async function focusRecentChatGptTab(
  context: Pick<WorkSurfaceContext, 'latestChatGptTabId' | 'latestChatGptWindowId'>
): Promise<boolean> {
  if (typeof context.latestChatGptTabId !== 'number') {
    return false;
  }

  await chrome.tabs.update(context.latestChatGptTabId, { active: true });
  if (typeof context.latestChatGptWindowId === 'number' && chrome.windows?.update) {
    await chrome.windows.update(context.latestChatGptWindowId, { focused: true });
  }
  return true;
}

export async function openNewChatGptTab(): Promise<void> {
  await chrome.tabs.create({
    url: 'https://chatgpt.com/'
  });
}
