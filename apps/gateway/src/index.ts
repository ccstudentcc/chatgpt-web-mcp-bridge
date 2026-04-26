import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { readOrCreateToken, tokenPath } from './security/token.js';
import { createServer } from './server.js';

async function main() {
  const config = await loadConfig();
  const token = config.trustedLocalMode ? undefined : await readOrCreateToken();
  const logger = createLogger();
  const server = await createServer(config, token, logger);

  await server.listen({ host: config.host, port: config.port });
  console.log(`Gateway listening on http://${config.host}:${config.port}`);
  if (config.trustedLocalMode) {
    console.log('Trusted local mode enabled: token auth is disabled for localhost requests.');
  } else {
    console.log(`Pairing token saved at ${tokenPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
