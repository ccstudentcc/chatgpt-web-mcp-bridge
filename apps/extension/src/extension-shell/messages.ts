export const EXTENSION_MESSAGE_TYPES = {
  ping: 'cwmb:extension-ping',
  gatewayRequest: 'cwmb:gateway-request',
  contentScriptReady: 'cwmb:content-script-ready'
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
