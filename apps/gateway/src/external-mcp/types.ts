import type { CatalogToolDescriptor } from '@cwmb/tool-contracts';

export type McpTransport = 'stdio' | 'sse' | 'http';
export type McpEndpointStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface McpEndpoint {
  endpointId: string;
  displayName: string;
  transport: McpTransport;
  status: McpEndpointStatus;
  url?: string;
  command?: string;
  args?: string[];
  lastError?: string;
}

export interface ExternalMcpServer {
  endpoint: McpEndpoint;
  tools: CatalogToolDescriptor[];
  updatedAt: string;
}

export interface ExternalMcpRegistry {
  listServers(): Promise<ExternalMcpServer[]>;
  getServer(endpointId: string): Promise<ExternalMcpServer | undefined>;
  upsertEndpoint(endpoint: McpEndpoint): Promise<McpEndpoint>;
  removeEndpoint(endpointId: string): Promise<boolean>;
  listTools(): Promise<CatalogToolDescriptor[]>;
}
