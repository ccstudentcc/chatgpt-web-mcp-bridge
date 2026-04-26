import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { readOrCreateToken, tokenPath } from './security/token.js';
import { createServer } from './server.js';

async function main() {
  const config = await loadConfig();
  const token = await readOrCreateToken();
  const logger = createLogger();
  const server = await createServer(config, token, logger);

  await server.listen({ host: config.host, port: config.port });
  console.log(`Gateway listening on http://${config.host}:${config.port}`);
  console.log(`Pairing token saved at ${tokenPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
