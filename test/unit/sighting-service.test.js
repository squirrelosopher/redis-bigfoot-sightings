import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../src/lib/errors.js';
import { SightingService } from '../../src/service/sighting-service.js';

function searchDocument(id, fields = {}) {
  return {
    key: 'sighting:' + id,
    fields: {
      id: String(id),
      title: 'A sighting',
      observed: 'Something was observed',
      location: '-87.4,34.1',
      ...fields,
    },
  };
}

function fakeRepository(overrides = {}) {
  return {
    search: vi.fn().mockResolvedValue({ total: 0, documents: [] }),
    aggregateByYear: vi.fn().mockResolvedValue([]),
    aggregateBySeason: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    listStates: vi.fn().mockResolvedValue([]),
    listCounties: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('SightingService', () => {
  it('requires a repository', () => {
    expect(() => new SightingService()).toThrow(TypeError);
  });

  describe('search', () => {
    it('compiles criteria into a query and passes it to every call', async () => {
      const repository = fakeRepository();
      const service = new SightingService(repository);

      const result = await service.search({ text: 'bear', state: 'Ohio' });

      expect(result.query).toBe('bear @state:{Ohio}');
      expect(repository.search).toHaveBeenCalledWith('bear @state:{Ohio}', expect.any(Object));
      expect(repository.aggregateByYear).toHaveBeenCalledWith('bear @state:{Ohio}');
      expect(repository.aggregateBySeason).toHaveBeenCalledWith('bear @state:{Ohio}');
    });

    it('answers unsatisfiable criteria without touching Redis', async () => {
      const repository = fakeRepository();
      const service = new SightingService(repository);

      // "*" reduces to no usable terms, so there is nothing to ask Redis.
      const result = await service.search({ text: '*', limit: 10, offset: 0 });

      expect(result).toEqual({
        query: null,
        total: 0,
        limit: 10,
        offset: 0,
        sightings: [],
        statistics: { byYear: [], bySeason: [] },
      });

      expect(repository.search).not.toHaveBeenCalled();
      expect(repository.aggregateByYear).not.toHaveBeenCalled();
      expect(repository.aggregateBySeason).not.toHaveBeenCalled();
    });

    it('marks the searched terms in the summaries it returns', async () => {
      const repository = fakeRepository({
        search: vi.fn().mockResolvedValue({
          total: 1,
          documents: [searchDocument(1, { observed: 'Seen by the river' })],
        }),
      });
      const service = new SightingService(repository);

      const { sightings } = await service.search({ text: 'river' });

      expect(sightings[0].observedHighlights).toEqual([
        { text: 'Seen by the ', match: false },
        { text: 'river', match: true },
      ]);
    });

    it('issues the three queries concurrently', async () => {
      let running = 0;
      let peak = 0;

      const track = (value) =>
        vi.fn(async () => {
          running += 1;
          peak = Math.max(peak, running);
          await new Promise((resolve) => setTimeout(resolve, 5));
          running -= 1;
          return value;
        });

      const repository = fakeRepository({
        search: track({ total: 0, documents: [] }),
        aggregateByYear: track([]),
        aggregateBySeason: track([]),
      });

      await new SightingService(repository).search({});

      expect(peak).toBe(3);
    });

    it('maps documents into summaries with parsed coordinates', async () => {
      const repository = fakeRepository({
        search: vi.fn().mockResolvedValue({ total: 1, documents: [searchDocument(7)] }),
      });

      const { sightings, total } = await new SightingService(repository).search({});

      expect(total).toBe(1);
      expect(sightings[0]).toMatchObject({
        id: 7,
        title: 'A sighting',
        location: { longitude: -87.4, latitude: 34.1 },
      });
      expect(sightings[0].titleHighlights).toEqual([{ text: 'A sighting', match: false }]);
    });

    it('keeps a summary whose coordinates could not be parsed', async () => {
      const repository = fakeRepository({
        search: vi
          .fn()
          .mockResolvedValue({ total: 1, documents: [searchDocument(7, { location: '' })] }),
      });

      const { sightings } = await new SightingService(repository).search({});

      expect(sightings[0].location).toBeNull();
    });

    it('drops the bucket RediSearch produces for undated reports', async () => {
      const repository = fakeRepository({
        aggregateByYear: vi.fn().mockResolvedValue([
          { year: '0', count: '19' },
          { year: '1998', count: '4' },
          { year: '1995', count: '9' },
        ]),
      });

      const { statistics } = await new SightingService(repository).search({});

      expect(statistics.byYear).toEqual([
        { year: 1995, count: 9 },
        { year: 1998, count: 4 },
      ]);
    });

    it('orders seasons by descending count and names the missing season', async () => {
      const repository = fakeRepository({
        aggregateBySeason: vi
          .fn()
          .mockResolvedValue([
            { season: 'Fall', count: '3' },
            { count: '5' },
            { season: 'Summer', count: '9' },
          ]),
      });

      const { statistics } = await new SightingService(repository).search({});

      expect(statistics.bySeason).toEqual([
        { season: 'Summer', count: 9 },
        { season: 'Unknown', count: 5 },
        { season: 'Fall', count: 3 },
      ]);
    });
  });

  describe('getById', () => {
    it('returns the stored report', async () => {
      const stored = { id: 7, title: 'A sighting' };
      const repository = fakeRepository({ findById: vi.fn().mockResolvedValue(stored) });

      await expect(new SightingService(repository).getById(7)).resolves.toEqual(stored);
    });

    it('raises NotFoundError when the report does not exist', async () => {
      const service = new SightingService(fakeRepository());

      await expect(service.getById(7)).rejects.toBeInstanceOf(NotFoundError);
      await expect(service.getById(7)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('getFacets', () => {
    let now;
    let repository;
    let service;

    beforeEach(() => {
      now = 1_000;
      repository = fakeRepository({
        listStates: vi.fn().mockResolvedValue(['Ohio']),
        listCounties: vi.fn().mockResolvedValue(['Athens']),
      });
      service = new SightingService(repository, { facetsTtlMs: 500, clock: () => now });
    });

    it('serves the cached value until the TTL expires', async () => {
      await service.getFacets();
      await service.getFacets();

      expect(repository.listStates).toHaveBeenCalledTimes(1);

      now += 501;
      await service.getFacets();

      expect(repository.listStates).toHaveBeenCalledTimes(2);
    });

    it('collapses concurrent misses into one round trip', async () => {
      const [first, second] = await Promise.all([service.getFacets(), service.getFacets()]);

      expect(repository.listStates).toHaveBeenCalledTimes(1);
      expect(first).toEqual({ states: ['Ohio'], counties: ['Athens'] });
      expect(second).toEqual(first);
    });

    it('refetches after the cache is invalidated', async () => {
      await service.getFacets();
      service.invalidateFacets();
      await service.getFacets();

      expect(repository.listStates).toHaveBeenCalledTimes(2);
    });
  });
});
