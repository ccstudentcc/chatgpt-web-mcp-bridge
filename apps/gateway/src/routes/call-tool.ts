import type { FastifyInstance } from 'fastify';
import { ToolCallRequestSchema } from '@cwmb/protocol';
import { AppError, truncateText } from '@cwmb/shared';
import type { GatewayConfig } from '../config.js';
import type { Logger } from '../logger.js';
import { assertAuthorized } from '../security/token.js';
import { createToolRegistry } from '../tools/index.js';
import { failure } from '../utils/errors.js';

export async function registerCallToolRoute(server: FastifyInstance, config: GatewayConfig, token: string, logger: Logger): Promise<void> {
  server.post('/call-tool', async (request) => {
    const started = Date.now();
    let toolName = 'unknown';
    let callId: string | undefined;
    try {
      assertAuthorized(request.headers, token);
      const parsed = ToolCallRequestSchema.safeParse(request.body);
      if (!parsed.success) throw new AppError('INVALID_ARGS', 'Invalid tool call request.', parsed.error.flatten());
      const req = parsed.data;
      toolName = req.tool;
      callId = req.source.callId;

      const registry = createToolRegistry(config);
      const tool = registry.get(req.tool);
      if (!tool) throw new AppError('TOOL_NOT_FOUND', `Tool not found: ${req.tool}`);
      if (!tool.enabled) throw new AppError(tool.name === 'run_pwsh' ? 'PWSH_DISABLED' : 'TOOL_DISABLED', `Tool disabled: ${req.tool}`);

      const args = tool.argsSchema.parse(req.args);
      const result = await tool.run(args, { config, logger });
      const serialized = JSON.stringify(result);
      const truncated = truncateText(serialized, config.maxGatewayResultChars);
      const safeResult = truncated.truncated
        ? { truncated: true, originalSizeChars: truncated.originalSizeChars, preview: truncated.text }
        : result;
      const toolWarnings = extractWarnings(result);
      const warnings = truncated.truncated
        ? [...toolWarnings, `Result truncated from ${truncated.originalSizeChars} chars.`]
        : toolWarnings;
      const durationMs = Date.now() - started;
      await logger.write({ ts: new Date().toISOString(), callId, tool: req.tool, risk: tool.risk, argsSummary: summarizeArgs(req.args), ok: true, durationMs, warnings });
      return { ok: true, tool: req.tool, result: safeResult, warnings, durationMs };
    } catch (err) {
      const durationMs = Date.now() - started;
      const response = failure(toolName, err, durationMs);
      await logger.write({ ts: new Date().toISOString(), callId, tool: toolName, ok: false, durationMs, warnings: response.warnings, resultSummary: response.error.code });
      return response;
    }
  });
}

function summarizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (key.toLowerCase().includes('content')) summary[key] = `[${String(value).length} chars]`;
    else summary[key] = value;
  }
  return summary;
}

function extractWarnings(result: unknown): string[] {
  if (!result || typeof result !== 'object' || !('warnings' in result)) {
    return [];
  }

  const maybeWarnings = (result as { warnings?: unknown }).warnings;
  return Array.isArray(maybeWarnings) ? maybeWarnings.filter((item): item is string => typeof item === 'string') : [];
}
