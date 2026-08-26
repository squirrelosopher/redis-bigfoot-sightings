import { createServer } from 'node:http';

import { createApp } from './app.js';
import { config } from './config/env.js';
import { logger } from './lib/logger.js';
import { createRedisClient } from './redis/client.js';
import { SightingRepository } from './repository/sighting-repository.js';
import { SightingService } from './service/sighting-service.js';

/**
 * Process entry point: wires the object graph, starts listening and shuts down
 * cleanly when the orchestrator sends a signal.
 */
async function main() {
  // The server does not block on Redis being up. ioredis connects in the
  // background and keeps retrying, and /health/ready reports the difference
  // between "the process is alive" and "it can actually serve searches", which
  // is exactly the distinction an orchestrator needs during a rolling restart.
  const redis = createRedisClient({ lazyConnect: false });

  const repository = new SightingRepository(redis);
  const service = new SightingService(repository);
  const server = createServer(createApp({ service, repository, logger }));

  server.listen(config.SERVER_PORT, () => {
    logger.info(
      { port: config.SERVER_PORT, environment: config.NODE_ENV },
      `listening on ${config.SERVER_HOST}:${config.SERVER_PORT}`,
    );
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.fatal({ port: config.SERVER_PORT }, 'port is already in use');
    } else if (error.code === 'EACCES') {
      logger.fatal({ port: config.SERVER_PORT }, 'port requires elevated privileges');
    } else {
      logger.fatal({ err: error }, 'server error');
    }

    process.exit(1);
  });

  installShutdownHandlers({ server, redis });
}

/**
 * Stops accepting connections, lets in-flight requests finish, then closes
 * Redis. A hard deadline guarantees the process exits even if a connection
 * refuses to drain.
 */
function installShutdownHandlers({ server, redis }) {
  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info({ signal }, 'shutting down');

    const forceExit = setTimeout(() => {
      logger.error('shutdown timed out, forcing exit');
      process.exit(1);
    }, config.SERVER_SHUTDOWN_TIMEOUT_MS);

    forceExit.unref();

    try {
      await new Promise((resolve) => server.close(resolve));
      await redis.quit();
      logger.info('shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'unhandled promise rejection');
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'uncaught exception');
    process.exit(1);
  });
}

main().catch((error) => {
  logger.fatal({ err: error }, 'failed to start');
  process.exit(1);
});
