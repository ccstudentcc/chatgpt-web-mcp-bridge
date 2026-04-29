import { buildToolCatalogPrompt } from '../injection-runtime/index.js';
import {
  deriveOperatorPanelViewState,
  type OperatorPanelViewInput,
  type OperatorPanelViewState,
  type PendingToolBlockLike
} from '../operator-panel/index.js';
import type { WorkSurfaceMode } from '../settings/contracts.js';

export interface WorkSurfaceSnapshot {
  conversationPath: string;
  mode: WorkSurfaceMode;
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

export function deriveWorkSurfaceSnapshot<TBlock extends PendingToolBlockLike>(
  input: OperatorPanelViewInput<TBlock> & {
    conversationPath: string;
    workSurfaceMode: WorkSurfaceMode;
  }
): WorkSurfaceSnapshot {
  return {
    conversationPath: input.conversationPath,
    mode: input.workSurfaceMode,
    title: 'ChatGPT MCP Bridge',
    subtitle: 'Security-first tool relay for ChatGPT Web',
    toolCatalogPrompt: input.catalogTools.length > 0 ? buildToolCatalogPrompt(input.catalogTools) : undefined,
    view: deriveOperatorPanelViewState(input)
  };
}
