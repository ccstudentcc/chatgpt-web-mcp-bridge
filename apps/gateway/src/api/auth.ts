import { TOKEN_HEADER } from '@cwmb/tool-contracts';
import { AppError } from '@cwmb/shared-utils';

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
