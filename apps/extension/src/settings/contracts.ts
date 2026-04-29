import type { RequestInjectionMode } from '../injection-runtime/index.js';

export type BooleanSettingOverride = boolean | 'inherit';
export type WorkSurfaceMode = 'floating_panel' | 'side_panel';

export interface ExtensionSettingsSnapshot {
  token: string;
  baseUrl: string;
  autoExecute: BooleanSettingOverride;
  autoInsert: BooleanSettingOverride;
  autoSend: BooleanSettingOverride;
  continueBatchOnError: boolean;
  requestInjectionMode: RequestInjectionMode;
  workSurfaceMode: WorkSurfaceMode;
}

export interface ExtensionSettingsPatch {
  token?: string;
  baseUrl?: string;
  autoExecute?: BooleanSettingOverride;
  autoInsert?: BooleanSettingOverride;
  autoSend?: BooleanSettingOverride;
  continueBatchOnError?: boolean;
  requestInjectionMode?: RequestInjectionMode;
  workSurfaceMode?: WorkSurfaceMode;
}

export interface ActiveTabBridgeSummary {
  path?: string;
  hasDomAccess: boolean;
  status: string;
  pendingCount: number;
  lastError?: string;
  requestHookStatus?: string;
  requestPromptSource?: string;
  catalogSource?: string;
  catalogVersion?: string;
  updatedAt: number;
}

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettingsSnapshot = {
  token: '',
  baseUrl: 'http://127.0.0.1:8024',
  autoExecute: 'inherit',
  autoInsert: 'inherit',
  autoSend: 'inherit',
  continueBatchOnError: false,
  requestInjectionMode: 'synthetic_system',
  workSurfaceMode: 'floating_panel'
};
