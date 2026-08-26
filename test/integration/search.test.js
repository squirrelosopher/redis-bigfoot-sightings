import request from 'supertest';
import { GenericContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { createRedisClient } from '../../src/redis/client.js';
import { SightingRepository } from '../../src/repository/sighting-repository.js';
import { SightingService } from '../../src/service/sighting-service.js';
import { logger } from '../../src/lib/logger.js';

/**
 * These exercise the parts unit tests deliberately do not cover: that the query
 * strings this codebase generates are accepted by RediSearch, that the reply
 * shapes it parses are the ones RediSearch actually returns, and that the
 * whole stack answers over HTTP.
 *
 * A real Redis 8 container is used rather than a mock, because the value here
 * is precisely in checking the assumptions a mock would encode.
 */

const REDIS_IMAGE = 'redis:8-alpine';

/** Reports chosen so each search below has an unambiguous expected answer. */
const FIXTURES = [
  {
    id: 1,
    title: 'Canoeist hears whoops along the river',
    observed: 'While canoeing on the river at dusk I heard loud whoops from the far bank.',
    date: Date.UTC(2004, 6, 14) / 1000,
    classification: 'Class B',
    county: 'Winston',
    state: 'Alabama',
    season: 'Summer',
    location: '-87.4,34.1',
    locationDetails: 'Near the boat launch',
  },
  {
    id: 2,
    title: 'Hiker sees a large figure near the ridge',
    observed: 'A tall figure crossed the trail ahead of me and moved into the trees.',
    date: Date.UTC(2004, 11, 2) / 1000,
    classification: 'Class A',
    county: 'Pierce',
    state: 'Washington',
    season: 'Winter',
    location: '-122.3,47.0',
    locationDetails: 'Above the ridge line',
  },
  {
    id: 3,
    title: 'Campers report a bear like shape by the river',
    observed: 'Something bear like waded across the river below our campsite.',
    date: Date.UTC(1998, 3, 20) / 1000,
    classification: 'Class B',
    county: 'Pierce',
    state: 'Washington',
    season: 'Spring',
    location: '-122.1,46.9',
    locationDetails: 'Downstream of the campsite',
  },
  {
    id: 4,
    title: 'Undated roadside encounter',
    observed: 'A figure stood at the roadside and then walked away into the fog.',
    date: null,
    classification: 'Class C',
    county: 'Athens',
    state: 'Ohio',
    season: 'Fall',
    location: '-82.1,39.3',
    locationDetails: 'County road',
  },
];

describe('search against a real Redis', () => {
  let container;
  let redis;
  let repository;
  let app;

  beforeAll(async () => {
    container = await new GenericContainer(REDIS_IMAGE)
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
      .start();

    redis = createRedisClient({
      host: container.getHost(),
      port: container.getMappedPort(6379),
      username: undefined,
      password: undefined,
      lazyConnect: true,
    });

    await redis.connect();

    repository = new SightingRepository(redis, { indexName: 'test-sightings-index' });
    const service = new SightingService(repository, { facetsTtlMs: 0 });
    app = createApp({ service, repository, logger });

    await repository.createIndex();
    await repository.saveBatch(FIXTURES);
    await waitForIndexedCount(repository, FIXTURES.length);
  });

  afterAll(async () => {
    await redis?.quit().catch(() => redis.disconnect());
    await container?.stop();
  });

  describe('the index', () => {
    it('reports ready once Redis and the index are both up', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ status: 'ok', redis: 'ok', index: 'ok' });
    });

    it('covers every seeded report', async () => {
      const { total } = await repository.search('*');

      expect(total).toBe(FIXTURES.length);
    });
  });

  describe('full text search', () => {
    it('finds reports containing a single term', async () => {
      const response = await request(app).get('/api/sightings?text=river');

      expect(response.status).toBe(200);
      expect(idsOf(response)).toEqual([1, 3]);
    });

    it('requires every term to be present', async () => {
      const response = await request(app).get('/api/sightings?text=river bear');

      expect(response.body.query).toBe('(river bear)');
      expect(idsOf(response)).toEqual([3]);
    });

    it('marks the matched terms as highlight segments', async () => {
      const response = await request(app).get('/api/sightings?text=river');
      const [first] = response.body.sightings;

      expect(first.observedHighlights.some((segment) => segment.match)).toBe(true);
      expect(first.observedHighlights.map((segment) => segment.text).join('')).toBe(first.observed);
    });

    it('returns no markup in any field', async () => {
      const response = await request(app).get('/api/sightings?text=river');

      expect(JSON.stringify(response.body)).not.toMatch(/<b>|<\/b>/);
    });
  });

  describe('tag filters', () => {
    it('filters by state', async () => {
      const response = await request(app).get('/api/sightings?state=Washington');

      expect(idsOf(response)).toEqual([2, 3]);
    });

    it('combines state, county and text', async () => {
      const response = await request(app).get(
        '/api/sightings?state=Washington&county=Pierce&text=river',
      );

      expect(idsOf(response)).toEqual([3]);
    });
  });

  describe('geospatial search', () => {
    it('returns only reports inside the radius', async () => {
      const response = await request(app).get(
        '/api/sightings?lon=-122.2&lat=47.0&radius=100&units=km',
      );

      expect(idsOf(response)).toEqual([2, 3]);
    });

    it('excludes reports outside the radius', async () => {
      const response = await request(app).get(
        '/api/sightings?lon=-122.2&lat=47.0&radius=5&units=km',
      );

      expect(idsOf(response)).toEqual([]);
    });
  });

  describe('aggregations', () => {
    it('groups by year and omits undated reports', async () => {
      const response = await request(app).get('/api/sightings');
      const { byYear } = response.body.statistics;

      expect(byYear).toEqual([
        { year: 1998, count: 1 },
        { year: 2004, count: 2 },
      ]);
    });

    it('groups by season', async () => {
      const response = await request(app).get('/api/sightings?state=Washington');
      const seasons = response.body.statistics.bySeason.map((bucket) => bucket.season).sort();

      expect(seasons).toEqual(['Spring', 'Winter']);
    });
  });

  describe('untrusted input reaches Redis safely', () => {
    it.each([
      ['a wildcard', 'text=*'],
      ['a field selector', 'text=%40state%3A%7BOhio%7D'],
      ['an unbalanced brace in a tag', 'state=Ohio%7D%20%7C%20%40county%3A%7BAthens'],
      ['query operators', 'text=%22%7C-%2B~'],
      ['a very long term', 'text=' + 'a'.repeat(200)],
    ])('%s does not error or widen the search', async (_label, query) => {
      const response = await request(app).get('/api/sightings?' + query);

      expect(response.status).toBe(200);
      // Nothing injected may match more than the honest query would.
      expect(response.body.total).toBeLessThan(FIXTURES.length);
    });

    it('a syntactically hostile tag matches nothing rather than everything', async () => {
      const response = await request(app).get(
        '/api/sightings?state=Ohio%7D%20%7C%20%40county%3A%7BAthens',
      );

      expect(response.body.total).toBe(0);
    });
  });

  describe('retrieving one report', () => {
    it('returns the stored document', async () => {
      const response = await request(app).get('/api/sightings/1');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: 1,
        state: 'Alabama',
        county: 'Winston',
        location: '-87.4,34.1',
      });
    });

    it('preserves a null date rather than inventing one', async () => {
      const response = await request(app).get('/api/sightings/4');

      expect(response.body.date).toBeNull();
    });

    it('answers 404 for an id that does not exist', async () => {
      const response = await request(app).get('/api/sightings/999999');

      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toContain('application/problem+json');
    });
  });

  describe('facets', () => {
    it('lists the distinct states and counties', async () => {
      const response = await request(app).get('/api/facets');

      expect(response.body.states).toEqual(['Alabama', 'Ohio', 'Washington']);
      expect(response.body.counties).toEqual(['Athens', 'Pierce', 'Winston']);
    });
  });

  describe('clearing data', () => {
    it('removes the index and every document', async () => {
      const scratch = new SightingRepository(redis, { indexName: 'scratch-index' });

      await scratch.createIndex();
      expect(await scratch.indexExists()).toBe(true);

      expect(await scratch.dropIndex()).toBe(true);
      expect(await scratch.indexExists()).toBe(false);
      // Dropping an index that is already gone is not an error.
      expect(await scratch.dropIndex()).toBe(false);
    });
  });
});

function idsOf(response) {
  return response.body.sightings.map((sighting) => sighting.id).sort((a, b) => a - b);
}

/**
 * RediSearch indexes JSON writes asynchronously, so a freshly seeded data set
 * can lag the write by a few milliseconds.
 */
async function waitForIndexedCount(repository, expected, attempts = 50) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { total } = await repository.search('*');

    if (total >= expected) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('index did not catch up with the seeded fixtures');
}
