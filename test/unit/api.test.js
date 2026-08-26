import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.js';
import { NotFoundError } from '../../src/lib/errors.js';
import { logger } from '../../src/lib/logger.js';

function buildApp({ service = {}, repository = {} } = {}) {
  return createApp({
    service: {
      search: vi.fn().mockResolvedValue({
        query: '*',
        total: 0,
        limit: 5000,
        offset: 0,
        sightings: [],
        statistics: { byYear: [], bySeason: [] },
      }),
      getById: vi.fn().mockResolvedValue({ id: 1 }),
      getFacets: vi.fn().mockResolvedValue({ states: [], counties: [] }),
      ...service,
    },
    repository: {
      ping: vi.fn().mockResolvedValue('PONG'),
      indexExists: vi.fn().mockResolvedValue(true),
      indexName: 'sightings-index',
      ...repository,
    },
    logger,
  });
}

describe('GET /api/sightings', () => {
  it('returns results for an empty query', async () => {
    const response = await request(buildApp()).get('/api/sightings');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 0, sightings: [] });
  });

  it('forwards validated criteria to the service', async () => {
    const search = vi.fn().mockResolvedValue({
      query: '*',
      total: 0,
      limit: 10,
      offset: 0,
      sightings: [],
      statistics: { byYear: [], bySeason: [] },
    });

    await request(buildApp({ service: { search } })).get(
      '/api/sightings?text=bear&state=Ohio&lon=-110&lat=55&radius=500&units=mi&limit=10',
    );

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'bear',
        state: 'Ohio',
        longitude: -110,
        latitude: 55,
        radius: 500,
        units: 'mi',
        limit: 10,
      }),
    );
  });

  it('treats blank parameters as absent, the way an HTML form submits them', async () => {
    const search = vi.fn().mockResolvedValue({
      query: '*',
      total: 0,
      limit: 5000,
      offset: 0,
      sightings: [],
      statistics: { byYear: [], bySeason: [] },
    });

    const response = await request(buildApp({ service: { search } })).get(
      '/api/sightings?text=&state=&county=&radius=&limit=',
    );

    expect(response.status).toBe(200);
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ text: undefined, state: undefined, radius: undefined }),
    );
  });

  describe('rejects out of range criteria', () => {
    it.each([
      ['longitude', 'lon=999'],
      ['latitude', 'lat=91'],
      ['radius', 'radius=-1'],
      ['units', 'units=parsec'],
      ['limit', 'limit=0'],
      ['limit above the cap', 'limit=999999'],
      ['offset', 'offset=-1'],
    ])('%s', async (_label, query) => {
      const response = await request(buildApp()).get('/api/sightings?' + query);

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.body).toMatchObject({ status: 400, title: 'validation_failed' });
      expect(response.body.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('GET /api/sightings/:id', () => {
  it('returns the report', async () => {
    const getById = vi.fn().mockResolvedValue({ id: 42, title: 'A sighting' });
    const response = await request(buildApp({ service: { getById } })).get('/api/sightings/42');

    expect(response.status).toBe(200);
    expect(getById).toHaveBeenCalledWith(42);
  });

  it('rejects an id that is not a number, rather than passing it to Redis', async () => {
    const getById = vi.fn();
    const response = await request(buildApp({ service: { getById } })).get(
      '/api/sightings/1%20OR%201',
    );

    expect(response.status).toBe(400);
    expect(getById).not.toHaveBeenCalled();
  });

  it('reports a missing report as 404', async () => {
    const getById = vi.fn().mockRejectedValue(new NotFoundError('no sighting with id 9'));
    const response = await request(buildApp({ service: { getById } })).get('/api/sightings/9');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ status: 404, detail: 'no sighting with id 9' });
  });
});

describe('error handling', () => {
  it('reports an unexpected failure as 500 without leaking the message', async () => {
    const search = vi.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:6379'));
    const response = await request(buildApp({ service: { search } })).get('/api/sightings');

    expect(response.status).toBe(500);
    expect(response.body.detail).toBe('the request could not be processed');
    expect(JSON.stringify(response.body)).not.toContain('ECONNREFUSED');
  });

  it('reports a Redis outage as 503, so callers know it is worth retrying', async () => {
    const outage = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:6379'), {
      code: 'ECONNREFUSED',
    });
    const search = vi.fn().mockRejectedValue(outage);
    const response = await request(buildApp({ service: { search } })).get('/api/sightings');

    expect(response.status).toBe(503);
    expect(response.body.title).toBe('service_unavailable');
    // The internal error code must not become part of the response.
    expect(JSON.stringify(response.body)).not.toContain('ECONNREFUSED');
  });

  it('answers an unknown route with 404, not the 404 the old handler defaulted to for everything', async () => {
    const response = await request(buildApp()).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.title).toBe('not_found');
  });
});

describe('health', () => {
  it('reports liveness', async () => {
    const response = await request(buildApp()).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('reports readiness when redis and the index are both available', async () => {
    const response = await request(buildApp()).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', index: 'ok' });
  });

  it('is not ready while the index is missing', async () => {
    const repository = { indexExists: vi.fn().mockResolvedValue(false) };
    const response = await request(buildApp({ repository })).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('degraded');
  });

  it('is not ready when redis is unreachable', async () => {
    const repository = { ping: vi.fn().mockRejectedValue(new Error('connection refused')) };
    const response = await request(buildApp({ repository })).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('unavailable');
  });
});

describe('security headers', () => {
  it('sets a content security policy and hides the framework', async () => {
    const response = await request(buildApp()).get('/health/live');

    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
