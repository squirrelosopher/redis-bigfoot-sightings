import { z } from 'zod';
import { config } from '../config/env.js';
import { SUPPORTED_DISTANCE_UNITS } from '../search/query-builder.js';

/**
 * Request schemas. Validation happens at the edge so that everything below the
 * router can assume it is working with well typed, in-range values.
 */

/**
 * HTML forms submit unfilled inputs as empty strings. Treating those as "absent"
 * rather than "invalid" is what lets the same schema back both the API and the
 * search form.
 */
const blankToUndefined = (value) =>
  typeof value === 'string' && value.trim().length === 0 ? undefined : value;

const optional = (schema) => z.preprocess(blankToUndefined, schema.optional());

const MAX_TEXT_LENGTH = 200;
const MAX_TAG_LENGTH = 120;
const MAX_RADIUS = 20_000;
const MAX_LATITUDE = 85.05112878;

export const searchQuerySchema = z
  .object({
    text: optional(z.string().trim().max(MAX_TEXT_LENGTH)),
    state: optional(z.string().trim().max(MAX_TAG_LENGTH)),
    county: optional(z.string().trim().max(MAX_TAG_LENGTH)),

    lon: optional(z.coerce.number().min(-180).max(180)),
    lat: optional(z.coerce.number().min(-MAX_LATITUDE).max(MAX_LATITUDE)),
    radius: optional(z.coerce.number().positive().max(MAX_RADIUS)),
    units: z.preprocess(blankToUndefined, z.enum(SUPPORTED_DISTANCE_UNITS).default('km')),

    limit: z.preprocess(
      blankToUndefined,
      z.coerce
        .number()
        .int()
        .min(1)
        .max(config.SEARCH_MAX_LIMIT)
        .default(config.SEARCH_DEFAULT_LIMIT),
    ),
    offset: z.preprocess(blankToUndefined, z.coerce.number().int().min(0).default(0)),
  })
  .transform(({ lon, lat, ...rest }) => ({
    ...rest,
    longitude: lon,
    latitude: lat,
  }));

export const sightingIdSchema = z.object({
  id: z.coerce.number().int().nonnegative(),
});

/**
 * Flattens Zod issues into a client friendly list.
 * @param {import('zod').ZodError} error
 */
export function formatIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}
