import {
  EXTENSION_MESSAGE_TYPES,
  type GetWorkSurfaceSnapshotMessage,
  type RunWorkSurfaceActionMessage
} from '../extension-shell/messages.js';
import type {
  WorkSurfaceActionRequest,
  WorkSurfaceSnapshot
} from '../operator-workflows/index.js';

type WorkSurfaceResponse<T> = T | { error?: string };

async function sendWorkSurfaceMessage<T>(tabId: number, message: unknown): Promise<T> {
  const response = await chrome.tabs.sendMessage(tabId, message) as WorkSurfaceResponse<T>;

  if (response && typeof response === 'object' && 'error' in response && typeof response.error === 'string') {
    throw new Error(response.error);
  }

  return response as T;
}

export async function getTabWorkSurfaceSnapshot(tabId: number): Promise<WorkSurfaceSnapshot> {
  const message: GetWorkSurfaceSnapshotMessage = {
    type: EXTENSION_MESSAGE_TYPES.getWorkSurfaceSnapshot
  };

  return sendWorkSurfaceMessage<WorkSurfaceSnapshot>(tabId, message);
}

export async function runTabWorkSurfaceAction(
  tabId: number,
  action: WorkSurfaceActionRequest
): Promise<void> {
  const message: RunWorkSurfaceActionMessage = {
    type: EXTENSION_MESSAGE_TYPES.runWorkSurfaceAction,
    action
  };

  await sendWorkSurfaceMessage<void>(tabId, message);
}
