import { buildToolCatalogPrompt } from '../injection-runtime/index.js';
import {
  deriveOperatorPanelViewState,
  type OperatorPanelViewInput,
  type OperatorPanelViewState,
  type PendingToolBlockLike
} from '../operator-panel/index.js';
import type { PanelSize } from '../main/state.js';
import type { WorkSurfaceMode } from '../settings/contracts.js';
import type { OperatorPanelToggleView } from '../operator-panel/index.js';

export interface WorkSurfaceSnapshot {
  conversationPath: string;
  mode: WorkSurfaceMode;
  panelSize?: PanelSize;
  title: string;
  subtitle: string;
  toolCatalogPrompt?: string;
  view: OperatorPanelViewState;
}

export type WorkSurfaceActionRequest =
  | { type: 'run_pending' }
  | { type: 'ignore_pending' }
  | { type: 'retry_batch' }
  | { type: 'insert_result' }
  | { type: 'insert_catalog' }
  | { type: 'update_token'; token: string }
  | { type: 'update_base_url'; baseUrl: string }
  | { type: 'refresh_gateway' }
  | { type: 'toggle_execute' }
  | { type: 'toggle_insert' }
  | { type: 'toggle_send' }
  | { type: 'toggle_continue_batch' };

export function getToggleActionRequest(toggle: OperatorPanelToggleView): WorkSurfaceActionRequest | null {
  switch (toggle.action) {
    case 'toggle-execute':
      return { type: 'toggle_execute' };
    case 'toggle-insert':
      return { type: 'toggle_insert' };
    case 'toggle-send':
      return { type: 'toggle_send' };
    case 'toggle-continue-batch':
      return { type: 'toggle_continue_batch' };
    default:
      return null;
  }
}

export function deriveWorkSurfaceSnapshot<TBlock extends PendingToolBlockLike>(
  input: OperatorPanelViewInput<TBlock> & {
    conversationPath: string;
    panelSize?: PanelSize;
    workSurfaceMode: WorkSurfaceMode;
  }
): WorkSurfaceSnapshot {
  return {
    conversationPath: input.conversationPath,
    mode: input.workSurfaceMode,
    panelSize: input.panelSize,
    title: 'ChatGPT MCP Bridge',
    subtitle: 'Security-first tool relay for ChatGPT Web',
    toolCatalogPrompt: input.catalogTools.length > 0 ? buildToolCatalogPrompt(input.catalogTools) : undefined,
    view: deriveOperatorPanelViewState(input)
  };
}
