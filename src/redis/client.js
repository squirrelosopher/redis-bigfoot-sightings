import { Redis } from 'ioredis';
import { config } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * Creates a Redis client.
 *
 * The client is lazy: nothing connects at import time, which keeps module
 * loading side effect free and lets tests point a repository at a throwaway
 * server. Connection failures are logged and retried rather than terminating
 * the process, so a brief Redis outage degrades the service instead of killing
 * it.
 *
 * @param {import('ioredis').RedisOptions} [overrides]
 * @returns {Redis}
 */
export function createRedisClient(overrides = {}) {
  const client = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    username: config.REDIS_USERNAME,
    password: config.REDIS_PASSWORD || undefined,
    db: config.REDIS_DB,
    lazyConnect: true,
    enableAutoPipelining: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (attempt) => Math.min(attempt * 200, 5_000),
    ...overrides,
  });

  client.on('error', (error) => {
    logger.error({ err: error }, 'redis client error');
  });

  client.on('connect', () => {
    logger.info(
      { host: config.REDIS_HOST, port: config.REDIS_PORT, db: config.REDIS_DB },
      'connected to redis',
    );
  });

  client.on('reconnecting', (delay) => {
    logger.warn({ delay }, 'reconnecting to redis');
  });

  client.on('end', () => {
    logger.info('redis connection closed');
  });

  return client;
}
