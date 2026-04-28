import type { CatalogToolDescriptor } from '@cwmb/tool-contracts';
import type { ExternalMcpRegistry, ExternalMcpServer, McpEndpoint } from './types.js';

export function createNoopExternalMcpRegistry(): ExternalMcpRegistry {
  return {
    async listServers(): Promise<ExternalMcpServer[]> {
      return [];
    },
    async getServer() {
      return undefined;
    },
    async upsertEndpoint(endpoint: McpEndpoint) {
      return endpoint;
    },
    async removeEndpoint() {
      return false;
    },
    async listTools(): Promise<CatalogToolDescriptor[]> {
      return [];
    }
  };
}
