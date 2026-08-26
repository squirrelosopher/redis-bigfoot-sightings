import 'dotenv/config';
import { z } from 'zod';

/**
 * Every environment variable the application understands, with its type,
 * constraints and default. Validation happens once at startup so that a
 * misconfigured deployment fails immediately and loudly, instead of throwing
 * an obscure error on the first request.
 */
const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  SERVER_HOST: z.string().min(1).default('http://127.0.0.1'),
  SERVER_PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  SERVER_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(0).default(10_000),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  REDIS_HOST: z.string().min(1).default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_USERNAME: z.string().default('default'),
  REDIS_PASSWORD: z.string().default(''),
  REDIS_DB: z.coerce.number().int().min(0).max(15).default(0),

  SEARCH_INDEX_NAME: z.string().min(1).default('sightings-index'),
  SEARCH_MAX_LIMIT: z.coerce.number().int().min(1).max(50_000).default(10_000),
  SEARCH_DEFAULT_LIMIT: z.coerce.number().int().min(1).max(50_000).default(5_000),

  FACETS_CACHE_TTL_MS: z.coerce.number().int().min(0).default(300_000),

  DATA_FILE: z.string().min(1).default('data/bfro_reports_geocoded.csv'),
  DATA_LOAD_BATCH_SIZE: z.coerce.number().int().min(1).max(10_000).default(500),
});

/**
 * @param {Record<string, string | undefined>} source
 * @returns {Readonly<z.infer<typeof environmentSchema>>}
 */
function loadConfiguration(source = process.env) {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  if (result.data.SEARCH_DEFAULT_LIMIT > result.data.SEARCH_MAX_LIMIT) {
    throw new Error(
      'Invalid environment configuration:\n' +
        '  - SEARCH_DEFAULT_LIMIT: must be less than or equal to SEARCH_MAX_LIMIT',
    );
  }

  return Object.freeze(result.data);
}

export const config = loadConfiguration();
