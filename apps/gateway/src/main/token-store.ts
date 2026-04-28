import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { appHome } from '../config.js';

export const tokenPath = path.join(appHome, 'token');

export async function readOrCreateToken(): Promise<string> {
  await fs.mkdir(appHome, { recursive: true });

  try {
    const existing = (await fs.readFile(tokenPath, 'utf8')).trim();
    if (existing.length > 0) {
      return existing;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }

  const token = `cwmb_${crypto.randomBytes(32).toString('base64url')}`;
  await fs.writeFile(tokenPath, `${token}\n`, { encoding: 'utf8', mode: 0o600 });
  return token;
}
