import { describe, expect, it } from 'vitest';

import { deriveSidepanelSurfaceState } from './sidepanel-surface-state.js';

describe('deriveSidepanelSurfaceState', () => {
  it('routes non-ChatGPT tabs to an empty-state handoff', () => {
    expect(deriveSidepanelSurfaceState('side_panel', {
      activeTabIsChatGpt: false,
      activeSummary: null,
      latestSummary: {
        hasDomAccess: true,
        path: '/c/latest',
        pendingCount: 0,
        status: 'idle',
        updatedAt: 1
      },
      latestChatGptTabId: 12
    })).toMatchObject({
      kind: 'empty',
      primaryAction: 'focus_latest_chatgpt',
      secondaryAction: 'open_new_chatgpt',
      latestPath: '/c/latest'
    });
  });

  it('treats floating-panel mode as a disabled sidepanel host', () => {
    expect(deriveSidepanelSurfaceState('floating_panel', {
      activeTabIsChatGpt: true,
      activeSummary: {
        hasDomAccess: true,
        path: '/c/active',
        pendingCount: 1,
        status: 'executing',
        updatedAt: 1
      },
      latestSummary: null
    })).toMatchObject({
      kind: 'disabled'
    });
  });

  it('shows a bound state when the active tab is ChatGPT', () => {
    expect(deriveSidepanelSurfaceState('side_panel', {
      activeTabIsChatGpt: true,
      activeSummary: {
        hasDomAccess: true,
        path: '/c/active',
        pendingCount: 1,
        status: 'executing',
        updatedAt: 1
      },
      latestSummary: null
    })).toMatchObject({
      kind: 'bound'
    });
  });
});
