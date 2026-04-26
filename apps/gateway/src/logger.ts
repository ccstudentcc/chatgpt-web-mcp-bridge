import fs from 'node:fs/promises';
import path from 'node:path';
import { appHome } from './config.js';

export interface AuditLogEntry {
  ts: string;
  callId?: string;
  tool: string;
  risk?: string;
  argsSummary?: unknown;
  ok: boolean;
  durationMs: number;
  warnings?: string[];
  resultSummary?: unknown;
}

export interface Logger {
  write(entry: AuditLogEntry): Promise<void>;
}

export function createLogger(): Logger {
  return {
    async write(entry) {
      const logsDir = path.join(appHome, 'logs');
      await fs.mkdir(logsDir, { recursive: true });
      const file = path.join(logsDir, `${new Date().toISOString().slice(0, 10)}.jsonl`);
      await fs.appendFile(file, `${JSON.stringify(entry)}\n`, 'utf8');
    }
  };
}
