import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { GatewayHealthContract } from '@cwmb/tool-contracts';
import { registerGatewayCallToolRoute, registerGatewayHealthRoute, registerGatewayToolsRoute } from '../api/index.js';
import type { GatewayConfig } from '../config.js';
import { createGatewayHealthSnapshot } from '../diagnostics/index.js';
import { createExecutionKernel, type ExecutionKernel } from '../execution-kernel/index.js';
import { createNoopExternalMcpRegistry, type ExternalMcpRegistry } from '../external-mcp/index.js';
import type { Logger } from '../logger.js';
import { assertAllowedOrigin } from './origin-guard.js';
import { createNoopProposalEngine, type ProposalEngine } from '../proposal-engine/index.js';
import { createInMemoryResultCache, type InMemoryResultCacheOptions, type ResultCache } from '../result-cache/index.js';
import { createGatewayToolRegistry, type GatewayToolRegistry } from '../tool-registry/index.js';

export interface CreateGatewayRuntimeOptions {
  config: GatewayConfig;
  token?: string;
  logger: Logger;
  serverFactory?: () => FastifyInstance;
  createHealthSnapshot?: () => Promise<GatewayHealthContract>;
  toolRegistry?: GatewayToolRegistry;
  executionKernel?: ExecutionKernel;
  proposalEngine?: ProposalEngine;
  externalMcpRegistry?: ExternalMcpRegistry;
  resultCache?: ResultCache;
  resultCacheOptions?: InMemoryResultCacheOptions;
}

export interface GatewayRuntimeOwners {
  diagnostics: {
    createHealthSnapshot: () => Promise<GatewayHealthContract>;
  };
  toolRegistry: GatewayToolRegistry;
  executionKernel: ExecutionKernel;
  proposalEngine: ProposalEngine;
  externalMcpRegistry: ExternalMcpRegistry;
  resultCache: ResultCache;
  auditLog: Logger;
}

export interface GatewayRuntime {
  server: FastifyInstance;
  owners: GatewayRuntimeOwners;
}

export async function createGatewayRuntime(options: CreateGatewayRuntimeOptions): Promise<GatewayRuntime> {
  const server = options.serverFactory ? options.serverFactory() : Fastify({ logger: false });
  const toolRegistry = options.toolRegistry ?? createGatewayToolRegistry(options.config);
  const executionKernel = options.executionKernel ?? createExecutionKernel({
    config: options.config,
    logger: options.logger,
    registry: toolRegistry.tools
  });
  const proposalEngine = options.proposalEngine ?? createNoopProposalEngine();
  const externalMcpRegistry = options.externalMcpRegistry ?? createNoopExternalMcpRegistry();
  const resultCache = options.resultCache ?? createInMemoryResultCache(options.resultCacheOptions);
  const createHealthSnapshot = options.createHealthSnapshot ?? (() => createGatewayHealthSnapshot(options.config));

  const owners: GatewayRuntimeOwners = {
    diagnostics: { createHealthSnapshot },
    toolRegistry,
    executionKernel,
    proposalEngine,
    externalMcpRegistry,
    resultCache,
    auditLog: options.logger
  };

  server.addHook('onRequest', async (request) => {
    assertAllowedOrigin(request.headers);
  });

  await registerGatewayHealthRoute(server, {
    createHealthSnapshot: owners.diagnostics.createHealthSnapshot
  });
  await registerGatewayToolsRoute(server, {
    auth: {
      expectedToken: options.token,
      trustedLocalMode: options.config.trustedLocalMode
    },
    toolRegistry: owners.toolRegistry
  });
  await registerGatewayCallToolRoute(server, {
    auth: {
      expectedToken: options.token,
      trustedLocalMode: options.config.trustedLocalMode
    },
    executionKernel: owners.executionKernel
  });

  return {
    server,
    owners
  };
}

export async function createGatewayServer(options: CreateGatewayRuntimeOptions): Promise<FastifyInstance> {
  return (await createGatewayRuntime(options)).server;
}
