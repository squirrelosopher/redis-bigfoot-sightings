import { config } from '../config/env.js';
import { NotFoundError } from '../lib/errors.js';
import { highlightTerms } from '../search/highlight.js';
import { buildSearchQuery, toSearchTerms } from '../search/query-builder.js';
import { parseGeoPoint } from '../search/reply-parser.js';

/**
 * Reports predating this are data errors rather than sightings, and RediSearch
 * buckets undated documents under year 0. Filtering here replaces the previous
 * approach of blindly discarding the first row of the aggregation.
 */
const EARLIEST_PLAUSIBLE_YEAR = 1800;

/**
 * The terms are the same ones the query was built from, so what gets marked is
 * exactly what was searched for.
 *
 * @param {string[]} terms
 */
function toSummary(terms) {
  return ({ fields }) => ({
    id: Number(fields.id),
    title: toText(fields.title),
    titleHighlights: highlightTerms(fields.title, terms),
    observed: toText(fields.observed),
    observedHighlights: highlightTerms(fields.observed, terms),
    location: parseGeoPoint(fields.location),
  });
}

/** A field the index did not return is absent rather than the string "undefined". */
function toText(value) {
  return value === null || value === undefined ? '' : String(value);
}

/** The shape returned when the criteria cannot match anything. */
function emptyResult({ query, limit, offset }) {
  return {
    query,
    total: 0,
    limit,
    offset,
    sightings: [],
    statistics: { byYear: [], bySeason: [] },
  };
}

function toYearBucket(row) {
  return { year: Number(row.year), count: Number(row.count) };
}

function toSeasonBucket(row) {
  return { season: row.season ?? 'Unknown', count: Number(row.count) };
}

export class SightingService {
  #repository;
  #facetsTtlMs;
  #clock;
  #facetsCache = null;
  #facetsInFlight = null;

  /**
   * @param {import('../repository/sighting-repository.js').SightingRepository} repository
   * @param {{facetsTtlMs?: number, clock?: () => number}} [options]
   */
  constructor(repository, { facetsTtlMs = config.FACETS_CACHE_TTL_MS, clock = Date.now } = {}) {
    if (!repository) {
      throw new TypeError('a repository is required');
    }

    this.#repository = repository;
    this.#facetsTtlMs = facetsTtlMs;
    this.#clock = clock;
  }

  /**
   * Runs a search and both aggregations concurrently. They are independent
   * round trips against the same query, so there is no reason to await them in
   * sequence.
   *
   * @param {object} criteria validated search criteria
   */
  async search(criteria) {
    const query = buildSearchQuery(criteria);
    const terms = toSearchTerms(criteria.text);
    const limit = criteria.limit ?? config.SEARCH_DEFAULT_LIMIT;
    const offset = criteria.offset ?? 0;

    // Unsatisfiable criteria need no round trip: three requests to Redis would
    // only confirm what the query builder already established.
    if (query === null) {
      return emptyResult({ query, limit, offset });
    }

    const [result, yearRows, seasonRows] = await Promise.all([
      this.#repository.search(query, { limit, offset }),
      this.#repository.aggregateByYear(query),
      this.#repository.aggregateBySeason(query),
    ]);

    return {
      query,
      total: result.total,
      limit,
      offset,
      sightings: result.documents.map(toSummary(terms)),
      statistics: {
        byYear: yearRows
          .map(toYearBucket)
          .filter(
            (bucket) => Number.isFinite(bucket.year) && bucket.year >= EARLIEST_PLAUSIBLE_YEAR,
          )
          .sort((left, right) => left.year - right.year),
        bySeason: seasonRows
          .map(toSeasonBucket)
          .filter((bucket) => Number.isFinite(bucket.count))
          .sort((left, right) => right.count - left.count),
      },
    };
  }

  /**
   * @param {number} id
   * @throws {NotFoundError} when no report carries that id
   */
  async getById(id) {
    const sighting = await this.#repository.findById(id);

    if (sighting === null) {
      throw new NotFoundError(`no sighting with id ${id}`);
    }

    return sighting;
  }

  /**
   * The distinct states and counties that back the search form's autocomplete.
   *
   * These change only when data is reloaded, so the result is cached for a
   * configurable TTL. Concurrent misses share a single in-flight request rather
   * than each hitting Redis.
   */
  async getFacets() {
    const now = this.#clock();

    if (this.#facetsCache && now < this.#facetsCache.expiresAt) {
      return this.#facetsCache.value;
    }

    if (this.#facetsInFlight) {
      return this.#facetsInFlight;
    }

    this.#facetsInFlight = (async () => {
      const [states, counties] = await Promise.all([
        this.#repository.listStates(),
        this.#repository.listCounties(),
      ]);

      const value = { states, counties };
      this.#facetsCache = { value, expiresAt: this.#clock() + this.#facetsTtlMs };
      return value;
    })();

    try {
      return await this.#facetsInFlight;
    } finally {
      this.#facetsInFlight = null;
    }
  }

  /** Drops the cached facets, used after a data reload. */
  invalidateFacets() {
    this.#facetsCache = null;
  }
}
