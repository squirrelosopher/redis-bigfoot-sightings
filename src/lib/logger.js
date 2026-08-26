import pino from 'pino';
import { config } from '../config/env.js';

const usePrettyOutput = config.NODE_ENV === 'development';

/**
 * Structured JSON logger. Development gets human readable output via
 * `pino-pretty`; every other environment emits newline delimited JSON, which is
 * what log shippers expect.
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: 'bigfoot-sightings' },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    remove: true,
  },
  ...(usePrettyOutput
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname,service',
          },
        },
      }
    : {}),
});
