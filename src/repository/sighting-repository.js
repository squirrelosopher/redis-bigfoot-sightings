import { config } from '../config/env.js';
import { parseAggregateReply, parseSearchReply } from '../search/reply-parser.js';

/**
 * All Redis access lives here. The repository owns key naming, the index
 * definition and the shape of every RediSearch call; nothing above it knows
 * that Redis is the store.
 *
 * The client is injected rather than imported, so tests can hand in a client
 * pointed at a disposable container.
 */

const SIGHTING_KEY_PREFIX = 'sighting:';
const STATES_KEY = 'states';
const COUNTIES_KEY = 'counties';

export class SightingRepository {
  #redis;
  #indexName;

  /**
   * @param {import('ioredis').Redis} redis
   * @param {{indexName?: string}} [options]
   */
  constructor(redis, { indexName = config.SEARCH_INDEX_NAME } = {}) {
    if (!redis) {
      throw new TypeError('a redis client is required');
    }

    this.#redis = redis;
    this.#indexName = indexName;
  }

  get indexName() {
    return this.#indexName;
  }

  /** @param {number} id */
  static keyFor(id) {
    if (!Number.isInteger(id)) {
      throw new TypeError(`sighting id must be an integer, received: ${id}`);
    }

    return `${SIGHTING_KEY_PREFIX}${id}`;
  }

  async ping() {
    return this.#redis.ping();
  }

  async indexExists() {
    const indices = await this.#redis.call('FT._LIST');
    return Array.isArray(indices) && indices.includes(this.#indexName);
  }

  /**
   * (Re)creates the search index. `PREFIX` scopes it to sighting documents;
   * without it the index would try to cover every JSON key in the database.
   */
  async createIndex() {
    if (await this.indexExists()) {
      await this.dropIndex();
    }

    return this.#redis.call(
      'FT.CREATE',
      this.#indexName,
      'ON',
      'JSON',
      'PREFIX',
      1,
      SIGHTING_KEY_PREFIX,
      'SCHEMA',
      '$.id',
      'AS',
      'id',
      'NUMERIC',
      'SORTABLE',
      '$.title',
      'AS',
      'title',
      'TEXT',
      'WEIGHT',
      2,
      '$.observed',
      'AS',
      'observed',
      'TEXT',
      '$.location',
      'AS',
      'location',
      'GEO',
      '$.county',
      'AS',
      'county',
      'TAG',
      '$.state',
      'AS',
      'state',
      'TAG',
    );
  }

  /** @returns {Promise<boolean>} whether an index was actually dropped */
  async dropIndex() {
    if (!(await this.indexExists())) {
      return false;
    }

    await this.#redis.call('FT.DROPINDEX', this.#indexName);
    return true;
  }

  /**
   * @param {string} query
   * @param {{limit?: number, offset?: number}} [options]
   */
  async search(query, { limit = config.SEARCH_DEFAULT_LIMIT, offset = 0 } = {}) {
    // HIGHLIGHT and SUMMARIZE are deliberately absent: this index is built
    // `ON JSON`, and Redis rejects both clauses for JSON indexes with
    // `SEARCH_QUERY_BAD HIGHLIGHT/SUMMARIZE is not supported with JSON indexes`,
    // which failed every search request. `search/highlight.js` marks the terms
    // instead, so the API still answers with highlight segments.
    const reply = await this.#redis.call(
      'FT.SEARCH',
      this.#indexName,
      query,
      'LIMIT',
      offset,
      limit,
      'RETURN',
      4,
      'id',
      'title',
      'observed',
      'location',
    );

    return parseSearchReply(reply);
  }

  /** @param {string} query */
  async aggregateByYear(query) {
    const reply = await this.#redis.call(
      'FT.AGGREGATE',
      this.#indexName,
      query,
      'LOAD',
      4,
      '$.date',
      'AS',
      'date',
      '$.id',
      'APPLY',
      'year(@date)',
      'AS',
      'year',
      'GROUPBY',
      1,
      '@year',
      'REDUCE',
      'COUNT',
      0,
      'AS',
      'count',
      'SORTBY',
      2,
      '@year',
      'ASC',
      'LIMIT',
      0,
      10_000,
    );

    return parseAggregateReply(reply);
  }

  /** @param {string} query */
  async aggregateBySeason(query) {
    const reply = await this.#redis.call(
      'FT.AGGREGATE',
      this.#indexName,
      query,
      'LOAD',
      4,
      '$.season',
      'AS',
      'season',
      '$.id',
      'GROUPBY',
      1,
      '@season',
      'REDUCE',
      'COUNT',
      0,
      'AS',
      'count',
      'SORTBY',
      2,
      '@count',
      'DESC',
    );

    return parseAggregateReply(reply);
  }

  /**
   * @param {number} id
   * @returns {Promise<object | null>} null when no such report exists
   */
  async findById(id) {
    const raw = await this.#redis.call('JSON.GET', SightingRepository.keyFor(id));
    if (raw === null || raw === undefined) {
      return null;
    }

    return JSON.parse(raw);
  }

  /** @returns {Promise<string[]>} */
  async listStates() {
    const states = await this.#redis.smembers(STATES_KEY);
    return states.sort((left, right) => left.localeCompare(right));
  }

  /** @returns {Promise<string[]>} */
  async listCounties() {
    const counties = await this.#redis.smembers(COUNTIES_KEY);
    return counties.sort((left, right) => left.localeCompare(right));
  }

  /**
   * Writes a batch of reports in a single pipeline. Batching keeps the import
   * fast without buffering every command for the whole file in memory.
   *
   * @param {import('../domain/sighting.js').Sighting[]} sightings
   * @returns {Promise<{attempted: number, failed: number}>}
   */
  async saveBatch(sightings) {
    if (sightings.length === 0) {
      return { attempted: 0, failed: 0 };
    }

    const pipeline = this.#redis.pipeline();

    for (const sighting of sightings) {
      pipeline.call(
        'JSON.SET',
        SightingRepository.keyFor(sighting.id),
        '$',
        JSON.stringify(sighting),
      );

      if (sighting.state) {
        pipeline.sadd(STATES_KEY, sighting.state);
      }

      if (sighting.county) {
        pipeline.sadd(COUNTIES_KEY, sighting.county);
      }
    }

    const results = await pipeline.exec();
    const failed = (results ?? []).filter(([error]) => error !== null).length;

    return { attempted: results?.length ?? 0, failed };
  }

  /**
   * Removes every sighting document and both facet sets.
   *
   * Uses `SCAN` rather than `KEYS`: `KEYS` blocks the server for the duration of
   * the scan, which is fine for a demo and unacceptable anywhere else.
   *
   * @param {{batchSize?: number}} [options]
   * @returns {Promise<number>} number of deleted keys
   */
  async deleteAll({ batchSize = 500 } = {}) {
    let deleted = await this.#redis.del(STATES_KEY, COUNTIES_KEY);

    const stream = this.#redis.scanStream({
      match: `${SIGHTING_KEY_PREFIX}*`,
      count: batchSize,
    });

    for await (const keys of stream) {
      if (keys.length > 0) {
        deleted += await this.#redis.del(...keys);
      }
    }

    return deleted;
  }
}
