import {
  EXTENSION_MESSAGE_TYPES,
  type GetWorkSurfaceContextMessage,
  type GetActiveTabSummaryMessage,
  type GetSettingsMessage,
  type ReportActiveTabSummaryMessage,
  type UpdateSettingsMessage
} from '../extension-shell/messages.js';
import type { WorkSurfaceContext } from '../extension-shell/work-surface.js';
import type {
  ActiveTabBridgeSummary,
  ExtensionSettingsPatch,
  ExtensionSettingsSnapshot
} from './contracts.js';

async function sendRuntimeMessage<T>(message: unknown): Promise<T> {
  const response = await chrome.runtime.sendMessage(message) as T | { error?: string };

  if (response && typeof response === 'object' && 'error' in response && typeof response.error === 'string') {
    throw new Error(response.error);
  }

  return response as T;
}

export async function getExtensionSettings(): Promise<ExtensionSettingsSnapshot> {
  const message: GetSettingsMessage = {
    type: EXTENSION_MESSAGE_TYPES.getSettings
  };

  return sendRuntimeMessage<ExtensionSettingsSnapshot>(message);
}

export async function updateExtensionSettings(patch: ExtensionSettingsPatch): Promise<ExtensionSettingsSnapshot> {
  const message: UpdateSettingsMessage = {
    type: EXTENSION_MESSAGE_TYPES.updateSettings,
    patch
  };

  return sendRuntimeMessage<ExtensionSettingsSnapshot>(message);
}

export async function getActiveTabBridgeSummary(): Promise<ActiveTabBridgeSummary | null> {
  const message: GetActiveTabSummaryMessage = {
    type: EXTENSION_MESSAGE_TYPES.getActiveTabSummary
  };

  return sendRuntimeMessage<ActiveTabBridgeSummary | null>(message);
}

export async function getWorkSurfaceContext(): Promise<WorkSurfaceContext> {
  const message: GetWorkSurfaceContextMessage = {
    type: EXTENSION_MESSAGE_TYPES.getWorkSurfaceContext
  };

  return sendRuntimeMessage<WorkSurfaceContext>(message);
}

export async function reportActiveTabBridgeSummary(summary: ActiveTabBridgeSummary): Promise<void> {
  const message: ReportActiveTabSummaryMessage = {
    type: EXTENSION_MESSAGE_TYPES.reportActiveTabSummary,
    summary
  };

  await sendRuntimeMessage<void>(message);
}
