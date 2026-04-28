import type { GatewayHealthContract } from '@cwmb/protocol';
import type { GatewayConfig } from '../config.js';
import { appHome, resolveConfigPath } from '../config.js';
import { readAuditLogEntries, resolveAuditLogsDir, summarizeAuditLogEntries } from '../audit-log/index.js';
import { createGatewayHealthSnapshot } from './health.js';
import type { GatewayDiagnosticsBundle, GatewayRuntimeFacts } from './types.js';

interface CreateGatewayDiagnosticsBundleOptions {
  health?: GatewayHealthContract;
  generatedAt?: string;
  appHomeOverride?: string;
  readAuditEntriesImpl?: typeof readAuditLogEntries;
}

interface CreateGatewayRuntimeFactsOptions {
  appHomeOverride?: string;
}

export async function createGatewayDiagnosticsBundle(
  config: GatewayConfig,
  options: CreateGatewayDiagnosticsBundleOptions = {}
): Promise<GatewayDiagnosticsBundle> {
  const health = options.health ?? await createGatewayHealthSnapshot(config);
  const auditEntries = await (options.readAuditEntriesImpl ?? readAuditLogEntries)({
    appHomeOverride: options.appHomeOverride,
    maxFiles: config.logRetentionDays
  });

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    redacted: true,
    health,
    runtime: createGatewayRuntimeFacts(config, { appHomeOverride: options.appHomeOverride }),
    audit: summarizeAuditLogEntries(auditEntries)
  };
}

export function createGatewayRuntimeFacts(
  config: GatewayConfig,
  options: CreateGatewayRuntimeFactsOptions = {}
): GatewayRuntimeFacts {
  const resolvedAppHome = options.appHomeOverride ?? appHome;

  return {
    authMode: config.trustedLocalMode ? 'trusted_local' : 'token',
    configuredShell: config.shell,
    allowPwsh: config.allowPwsh,
    allowWrite: config.allowWrite,
    blockedPathCount: config.blockedPaths.length,
    logRetentionDays: config.logRetentionDays,
    maxFileSizeBytes: config.maxFileSizeBytes,
    maxInsertedChars: config.maxInsertedChars,
    maxGatewayResultChars: config.maxGatewayResultChars,
    configPath: resolveConfigPath(resolvedAppHome),
    logsDir: resolveAuditLogsDir(resolvedAppHome)
  };
}
