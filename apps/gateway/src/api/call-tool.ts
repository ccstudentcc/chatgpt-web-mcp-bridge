import type { ToolCallLiveResponse, ToolCallRequest } from '@cwmb/tool-contracts';
import { ToolCallRequestSchema } from '@cwmb/tool-contracts';
import { AppError } from '@cwmb/shared-utils';
import type { FastifyInstance } from 'fastify';
import { assertAuthorized } from './auth.js';
import type { GatewayRouteAuthContext } from './tools.js';

export interface GatewayCallToolOwner {
  executeLegacyToolCall: (request: ToolCallRequest) => Promise<ToolCallLiveResponse>;
}

export interface GatewayCallToolRouteDeps {
  auth: GatewayRouteAuthContext;
  executionKernel: GatewayCallToolOwner;
}

export async function registerGatewayCallToolRoute(
  server: FastifyInstance,
  deps: GatewayCallToolRouteDeps
): Promise<void> {
  server.post('/call-tool', async (request) => {
    assertAuthorized(request.headers, deps.auth);
    const parsed = ToolCallRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('INVALID_ARGS', 'Invalid tool call request.', parsed.error.flatten());
    }
    return deps.executionKernel.executeLegacyToolCall(parsed.data);
  });
}
