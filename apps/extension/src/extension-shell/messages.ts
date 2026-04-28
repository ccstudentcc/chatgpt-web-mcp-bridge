import type {
  ActiveTabBridgeSummary,
  ExtensionSettingsPatch,
  ExtensionSettingsSnapshot
} from '../settings/contracts.js';

export const EXTENSION_MESSAGE_TYPES = {
  ping: 'cwmb:extension-ping',
  gatewayRequest: 'cwmb:gateway-request',
  contentScriptReady: 'cwmb:content-script-ready',
  getSettings: 'cwmb:get-settings',
  updateSettings: 'cwmb:update-settings',
  settingsChanged: 'cwmb:settings-changed',
  getActiveTabSummary: 'cwmb:get-active-tab-summary',
  reportActiveTabSummary: 'cwmb:report-active-tab-summary'
} as const;

export interface GatewayProxyRequestMessage {
  type: typeof EXTENSION_MESSAGE_TYPES.gatewayRequest;
  request: {
    method: string;
    url: string;
    data?: string;
    headers?: Record<string, string>;
    timeout?: number;
  };
}

export interface PingMessage {
  type: typeof EXTENSION_MESSAGE_TYPES.ping;
  source: 'content-script';
}

export interface ContentScriptReadyMessage {
  type: typeof EXTENSION_MESSAGE_TYPES.contentScriptReady;
  path: string;
  hasDomAccess: boolean;
}

export interface GetSettingsMessage {
  type: typeof EXTENSION_MESSAGE_TYPES.getSettings;
}

export interface UpdateSettingsMessage {
  type: typeof EXTENSION_MESSAGE_TYPES.updateSettings;
  patch: ExtensionSettingsPatch;
}

export interface SettingsChangedMessage {
  type: typeof EXTENSION_MESSAGE_TYPES.settingsChanged;
  settings: ExtensionSettingsSnapshot;
}

export interface GetActiveTabSummaryMessage {
  type: typeof EXTENSION_MESSAGE_TYPES.getActiveTabSummary;
}

export interface ReportActiveTabSummaryMessage {
  type: typeof EXTENSION_MESSAGE_TYPES.reportActiveTabSummary;
  summary: ActiveTabBridgeSummary;
}
