import type { FastifyInstance } from 'fastify';
import {
  ToolCallRequestSchema
} from '@cwmb/protocol';
import { AppError } from '@cwmb/shared';
import type { GatewayConfig } from '../config.js';
import { createExecutionKernel } from '../execution-kernel/index.js';
import type { Logger } from '../logger.js';
import { assertAuthorized } from '../security/token.js';

export async function registerCallToolRoute(server: FastifyInstance, config: GatewayConfig, token: string | undefined, logger: Logger): Promise<void> {
  const executionKernel = createExecutionKernel({ config, logger });

  server.post('/call-tool', async (request) => {
    assertAuthorized(request.headers, { expectedToken: token, trustedLocalMode: config.trustedLocalMode });
    const parsed = ToolCallRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError('INVALID_ARGS', 'Invalid tool call request.', parsed.error.flatten());
    return await executionKernel.executeLegacyToolCall(parsed.data);
  });
}
