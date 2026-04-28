import type { GatewayHealthContract } from '@cwmb/protocol';
import type { AuditLogSummary } from '../audit-log/index.js';
import type { SupportedShell } from '../shell-runtime/index.js';

export interface GatewayRuntimeFacts {
  authMode: 'trusted_local' | 'token';
  configuredShell: SupportedShell;
  allowPwsh: boolean;
  allowWrite: boolean;
  blockedPathCount: number;
  logRetentionDays: number;
  maxFileSizeBytes: number;
  maxInsertedChars: number;
  maxGatewayResultChars: number;
  configPath: string;
  logsDir: string;
}

export interface GatewayDiagnosticsBundle {
  generatedAt: string;
  redacted: true;
  health: GatewayHealthContract;
  runtime: GatewayRuntimeFacts;
  audit: AuditLogSummary;
}
