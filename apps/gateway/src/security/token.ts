import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { TOKEN_HEADER } from '@cwmb/tool-contracts';
import { AppError } from '@cwmb/shared-utils';
import { appHome } from '../config.js';

export const tokenPath = path.join(appHome, 'token');

export async function readOrCreateToken(): Promise<string> {
  await fs.mkdir(appHome, { recursive: true });

  try {
    const existing = (await fs.readFile(tokenPath, 'utf8')).trim();
    if (existing.length > 0) return existing;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  const token = `cwmb_${crypto.randomBytes(32).toString('base64url')}`;
  await fs.writeFile(tokenPath, `${token}\n`, { encoding: 'utf8', mode: 0o600 });
  return token;
}

export function assertAuthorized(
  headers: Record<string, string | string[] | undefined>,
  options: { expectedToken?: string; trustedLocalMode: boolean }
): void {
  if (options.trustedLocalMode) {
    return;
  }

  const actual = headers[TOKEN_HEADER.toLowerCase()];
  const token = Array.isArray(actual) ? actual[0] : actual;
  if (!options.expectedToken || !token || token !== options.expectedToken) {
    throw new AppError('UNAUTHORIZED', 'Invalid or missing pairing token.');
  }
}
