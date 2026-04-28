import fs from 'node:fs/promises';
import path from 'node:path';
import { appHome } from '../config.js';
import type { AuditLogEntry, Logger } from './types.js';

export type { AuditLogEntry, Logger } from './types.js';

export function createLogger(): Logger {
  return {
    async write(entry: AuditLogEntry) {
      const logsDir = path.join(appHome, 'logs');
      await fs.mkdir(logsDir, { recursive: true });
      const file = path.join(logsDir, `${new Date().toISOString().slice(0, 10)}.jsonl`);
      await fs.appendFile(file, `${JSON.stringify(entry)}\n`, 'utf8');
    }
  };
}
