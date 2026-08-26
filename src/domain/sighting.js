import { z } from 'zod';

/**
 * Domain model for a single BFRO report, plus the mapping from a raw CSV row.
 *
 * The mapping is a pure function returning a discriminated result rather than
 * throwing: a bad row in a five thousand row import is expected, not
 * exceptional, and the caller wants to count skipped rows and carry on.
 */

const REPORT_TITLE_PREFIX = /^Report \d+:\s*/;
const COUNTY_SUFFIX = /\s+County$/i;

/** Shorter values are placeholder noise rather than real prose. */
const MINIMUM_TEXT_LENGTH = 4;

const sightingSchema = z.object({
  id: z.number().int().nonnegative(),
  title: z.string().min(MINIMUM_TEXT_LENGTH),
  observed: z.string().min(MINIMUM_TEXT_LENGTH),
  date: z.number().int().nullable(),
  classification: z.string().nullable(),
  county: z.string().nullable(),
  state: z.string().nullable(),
  season: z.string().nullable(),
  location: z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/),
  locationDetails: z.string().nullable(),
});

/** @typedef {z.infer<typeof sightingSchema>} Sighting */

function trimmedOrNull(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Blank is missing, not zero. `Number('')` evaluates to 0, which would quietly
 * place undated, uncoordinated reports on Null Island.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function toNumberOrNull(value) {
  const trimmed = trimmedOrNull(value);
  if (trimmed === null) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Seconds since the epoch, or null when the source date is absent or unusable.
 * Storing null rather than NaN keeps the JSON document valid and lets the
 * aggregation layer recognise undated reports instead of silently bucketing
 * them under a bogus year.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
export function toEpochSeconds(value) {
  const trimmed = trimmedOrNull(value);
  if (trimmed === null) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
}

/**
 * Maps one parsed CSV row onto a `Sighting`.
 *
 * A fresh object is built per row. The previous implementation reused a single
 * mutable builder across the whole import, so any field missing from a row
 * silently inherited the value of the row before it.
 *
 * @param {Record<string, string>} row
 * @returns {{ok: true, sighting: Sighting} | {ok: false, reason: string}}
 */
export function sightingFromCsvRow(row) {
  const id = Number.parseInt(row.number, 10);
  if (!Number.isInteger(id) || id < 0) {
    return { ok: false, reason: 'missing or invalid report number' };
  }

  const longitude = toNumberOrNull(row.longitude);
  const latitude = toNumberOrNull(row.latitude);
  if (longitude === null || latitude === null) {
    return { ok: false, reason: 'missing coordinates' };
  }

  const title = trimmedOrNull(row.title)?.replace(REPORT_TITLE_PREFIX, '').trim() ?? '';
  const observed = trimmedOrNull(row.observed) ?? '';

  if (title.length < MINIMUM_TEXT_LENGTH || observed.length < MINIMUM_TEXT_LENGTH) {
    return { ok: false, reason: 'title or observed text too short' };
  }

  const county = trimmedOrNull(row.county)?.replace(COUNTY_SUFFIX, '').trim() ?? null;

  const candidate = {
    id,
    title,
    observed,
    date: toEpochSeconds(row.date),
    classification: trimmedOrNull(row.classification),
    county: county && county.length > 0 ? county : null,
    state: trimmedOrNull(row.state),
    season: trimmedOrNull(row.season),
    location: `${longitude},${latitude}`,
    locationDetails: trimmedOrNull(row.location_details),
  };

  const result = sightingSchema.safeParse(candidate);
  if (!result.success) {
    return { ok: false, reason: result.error.issues[0]?.message ?? 'failed validation' };
  }

  return { ok: true, sighting: result.data };
}
