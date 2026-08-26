import { createRedisClient } from '../src/redis/client.js';
import { SightingRepository } from '../src/repository/sighting-repository.js';
import { logger } from '../src/lib/logger.js';

/**
 * Runs a one-shot task against Redis and always closes the connection, so the
 * script cannot hang the terminal on an open socket.
 *
 * @template T
 * @param {(repository: SightingRepository) => Promise<T>} task
 * @returns {Promise<T>}
 */
export async function withRepository(task) {
  const redis = createRedisClient();
  await redis.connect();

  try {
    return await task(new SightingRepository(redis));
  } finally {
    await redis.quit().catch(() => redis.disconnect());
  }
}

/**
 * Wraps a script body so failures are logged once and reflected in the exit
 * code, which is what CI and `docker compose` actually look at.
 *
 * @param {string} name
 * @param {() => Promise<void>} body
 */
export async function runScript(name, body) {
  try {
    await body();
  } catch (error) {
    logger.error({ err: error }, `${name} failed`);
    process.exitCode = 1;
  }
}
