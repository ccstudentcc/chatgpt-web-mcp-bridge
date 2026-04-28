import fs from 'node:fs/promises';
import path from 'node:path';
import { appHome } from '../config.js';
import type { AuditLogEntry, Logger } from './types.js';

export type { AuditLogEntry, Logger } from './types.js';

export function createLogger(): Logger {
  return {
    async write(entry: AuditLogEntry) {
      const logsDir = resolveAuditLogsDir();
      await fs.mkdir(logsDir, { recursive: true });
      const file = path.join(logsDir, `${new Date().toISOString().slice(0, 10)}.jsonl`);
      await fs.appendFile(file, `${JSON.stringify(entry)}\n`, 'utf8');
    }
  };
}

interface ReadAuditLogEntriesOptions {
  appHomeOverride?: string;
  maxFiles?: number;
}

export function resolveAuditLogsDir(appHomeRoot: string = appHome): string {
  return path.join(appHomeRoot, 'logs');
}

export async function readAuditLogEntries(options: ReadAuditLogEntriesOptions = {}): Promise<AuditLogEntry[]> {
  const logsDir = resolveAuditLogsDir(options.appHomeOverride ?? appHome);

  let files: string[];
  try {
    files = await fs.readdir(logsDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw err;
  }

  const selectedFiles = files
    .filter((name) => name.endsWith('.jsonl'))
    .sort()
    .slice(options.maxFiles === undefined ? 0 : -options.maxFiles);

  const entries: AuditLogEntry[] = [];
  for (const file of selectedFiles) {
    const raw = await fs.readFile(path.join(logsDir, file), 'utf8');
    for (const line of raw.split('\n')) {
      if (!line.trim()) {
        continue;
      }
      entries.push(JSON.parse(line) as AuditLogEntry);
    }
  }

  return entries;
}
