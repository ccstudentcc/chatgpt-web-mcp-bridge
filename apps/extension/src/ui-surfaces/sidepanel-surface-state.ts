import type { WorkSurfaceContext } from '../extension-shell/work-surface.js';
import type { WorkSurfaceMode } from '../settings/contracts.js';

export interface SidepanelSurfaceState {
  kind: 'disabled' | 'empty' | 'bound';
  title: string;
  description: string;
  primaryAction: 'focus_latest_chatgpt' | 'open_new_chatgpt' | null;
  latestPath: string;
}

export function deriveSidepanelSurfaceState(
  mode: WorkSurfaceMode,
  context: WorkSurfaceContext | null
): SidepanelSurfaceState {
  const latestPath = context?.latestSummary?.path ?? 'No recent ChatGPT tab';

  if (mode !== 'side_panel') {
    return {
      kind: 'disabled',
      title: 'Side panel inactive',
      description: 'This profile is currently using the floating panel mode. Switch modes from popup or the options tab if you want the Chrome side panel.',
      primaryAction: context?.latestChatGptTabId ? 'focus_latest_chatgpt' : 'open_new_chatgpt',
      latestPath
    };
  }

  if (!context?.activeTabIsChatGpt) {
    return {
      kind: 'empty',
      title: 'Open ChatGPT to continue',
      description: 'The selected work surface is the Chrome side panel, but the current tab is not ChatGPT. Focus the latest ChatGPT tab or open a new one to resume the live runtime.',
      primaryAction: context?.latestChatGptTabId ? 'focus_latest_chatgpt' : 'open_new_chatgpt',
      latestPath
    };
  }

  return {
    kind: 'bound',
    title: 'Side panel host ready',
    description: 'Stage 23 keeps the side panel focused on host exclusivity and tab binding. The shared work-surface app lands in Stage 24.',
    primaryAction: null,
    latestPath
  };
}
