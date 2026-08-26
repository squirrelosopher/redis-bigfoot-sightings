/**
 * Builds RediSearch query strings from user supplied search criteria.
 *
 * Everything in this module is a pure function operating on plain data, which
 * keeps the interesting logic - escaping untrusted input so it cannot alter the
 * shape of the query - fully unit testable without a Redis server.
 */

/**
 * Characters that carry meaning inside a RediSearch query and therefore have to
 * be backslash escaped when they appear inside a TAG value.
 * @see https://redis.io/docs/latest/develop/interact/search-and-query/advanced-concepts/escaping/
 */
const TAG_SPECIAL_CHARACTERS = /[,.<>{}[\]"':;!@#$%^&*()+=~|/\\ -]/g;

/** Anything that is not a letter or a digit separates two search terms. */
const TERM_SEPARATOR = /[^\p{L}\p{N}]+/u;

const SUPPORTED_DISTANCE_UNITS = Object.freeze(['m', 'km', 'mi', 'ft']);

/**
 * Escapes a value so it can be safely embedded in a `@field:{value}` clause.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeTagValue(value) {
  return String(value).replace(TAG_SPECIAL_CHARACTERS, '\\$&');
}

/**
 * Reduces free text to the bare alphanumeric terms it contains. Punctuation and
 * RediSearch operators are dropped rather than escaped: a search box is not a
 * query language, and silently ignoring syntax is friendlier than erroring.
 * @param {unknown} text
 * @returns {string[]}
 */
export function toSearchTerms(text) {
  if (text === null || text === undefined) {
    return [];
  }

  return String(text)
    .split(TERM_SEPARATOR)
    .filter((term) => term.length > 0);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * @param {{longitude?: number, latitude?: number, radius?: number, units?: string}} criteria
 * @returns {string | null}
 */
export function buildGeoClause({ longitude, latitude, radius, units = 'km' } = {}) {
  if (![longitude, latitude, radius].every(isFiniteNumber)) {
    return null;
  }

  if (radius <= 0 || Math.abs(longitude) > 180 || Math.abs(latitude) > 85.05112878) {
    return null;
  }

  if (!SUPPORTED_DISTANCE_UNITS.includes(units)) {
    return null;
  }

  return `@location:[${longitude} ${latitude} ${radius} ${units}]`;
}

/**
 * Composes the full RediSearch query. Clauses are space separated, which
 * RediSearch treats as an intersection (logical AND).
 *
 * @param {object} criteria
 * @param {string} [criteria.text] free text matched against title and observed
 * @param {string} [criteria.state]
 * @param {string} [criteria.county]
 * @param {number} [criteria.longitude]
 * @param {number} [criteria.latitude]
 * @param {number} [criteria.radius]
 * @param {string} [criteria.units]
 * @returns {string | null} a query string, `*` when no criteria were supplied,
 *   or `null` when the criteria cannot match anything
 */
export function buildSearchQuery(criteria = {}) {
  const clauses = [];

  const terms = toSearchTerms(criteria.text);

  // Free text was supplied but nothing survived reduction to terms - "*", or
  // "|-+~". Dropping the clause would leave a broader search than was asked
  // for: on its own it becomes a match-all, and next to a tag filter it
  // silently returns rows the text was meant to exclude. There is no RediSearch
  // expression for "match nothing" (an inverted numeric range is rejected as a
  // syntax error), so say so with `null` and let the caller skip the round trip.
  if (typeof criteria.text === 'string' && criteria.text.trim().length > 0 && terms.length === 0) {
    return null;
  }

  if (terms.length === 1) {
    clauses.push(terms[0]);
  } else if (terms.length > 1) {
    clauses.push(`(${terms.join(' ')})`);
  }

  if (criteria.state) {
    clauses.push(`@state:{${escapeTagValue(criteria.state)}}`);
  }

  if (criteria.county) {
    clauses.push(`@county:{${escapeTagValue(criteria.county)}}`);
  }

  const geoClause = buildGeoClause(criteria);
  if (geoClause) {
    clauses.push(geoClause);
  }

  return clauses.length > 0 ? clauses.join(' ') : '*';
}

export { SUPPORTED_DISTANCE_UNITS };
