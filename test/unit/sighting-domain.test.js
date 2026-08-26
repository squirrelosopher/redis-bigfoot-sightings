import { describe, expect, it } from 'vitest';

import { sightingFromCsvRow, toEpochSeconds } from '../../src/domain/sighting.js';

function csvRow(overrides = {}) {
  return {
    number: '30680',
    title: 'Report 30680: Canoeist hears whoops on the Sipsey river',
    observed: 'I was canoeing on the Sipsey river in Alabama at dusk.',
    date: '2010-08-15',
    classification: 'Class B',
    county: 'Winston County',
    state: 'Alabama',
    season: 'Summer',
    latitude: '34.1',
    longitude: '-87.4',
    location_details: 'Near the boat launch',
    ...overrides,
  };
}

describe('toEpochSeconds', () => {
  it('converts an ISO date to seconds', () => {
    expect(toEpochSeconds('1970-01-02')).toBe(86_400);
  });

  it('returns null rather than NaN for missing or invalid dates', () => {
    expect(toEpochSeconds('')).toBeNull();
    expect(toEpochSeconds('   ')).toBeNull();
    expect(toEpochSeconds(null)).toBeNull();
    expect(toEpochSeconds('not a date')).toBeNull();
  });
});

describe('sightingFromCsvRow', () => {
  it('maps a complete row', () => {
    const result = sightingFromCsvRow(csvRow());

    expect(result.ok).toBe(true);
    expect(result.sighting).toMatchObject({
      id: 30_680,
      title: 'Canoeist hears whoops on the Sipsey river',
      classification: 'Class B',
      county: 'Winston',
      state: 'Alabama',
      season: 'Summer',
      location: '-87.4,34.1',
      locationDetails: 'Near the boat launch',
    });
  });

  it('strips the report number prefix from the title', () => {
    const result = sightingFromCsvRow(csvRow({ title: 'Report 7: Something happened' }));

    expect(result.sighting.title).toBe('Something happened');
  });

  it('strips the County suffix so the tag matches what users type', () => {
    expect(sightingFromCsvRow(csvRow({ county: 'Prince George County' })).sighting.county).toBe(
      'Prince George',
    );
  });

  it('stores longitude before latitude, as RediSearch GEO expects', () => {
    expect(sightingFromCsvRow(csvRow()).sighting.location).toBe('-87.4,34.1');
  });

  describe('rejects rows that cannot be indexed', () => {
    it.each([
      ['no coordinates', { latitude: '', longitude: '' }],
      ['no latitude', { latitude: '' }],
      ['no report number', { number: '' }],
      ['a non numeric report number', { number: 'abc' }],
      ['an empty title', { title: '' }],
      ['a placeholder title', { title: 'n/a' }],
      ['an empty observation', { observed: '' }],
    ])('%s', (_label, overrides) => {
      const result = sightingFromCsvRow(csvRow(overrides));

      expect(result.ok).toBe(false);
      expect(result.reason).toBeTypeOf('string');
    });
  });

  it('keeps an undated report, with a null date', () => {
    const result = sightingFromCsvRow(csvRow({ date: '' }));

    expect(result.ok).toBe(true);
    expect(result.sighting.date).toBeNull();
  });

  it('maps blank optional fields to null instead of empty strings', () => {
    const result = sightingFromCsvRow(
      csvRow({ classification: '', season: '   ', location_details: '' }),
    );

    expect(result.sighting).toMatchObject({
      classification: null,
      season: null,
      locationDetails: null,
    });
  });

  it('does not carry values across rows', () => {
    // Regression: the importer used to reuse one mutable builder for the whole
    // file, so a row missing a field silently inherited the previous row's.
    const complete = sightingFromCsvRow(csvRow({ number: '1', season: 'Winter' }));
    const sparse = sightingFromCsvRow(csvRow({ number: '2', season: '' }));

    expect(complete.sighting.season).toBe('Winter');
    expect(sparse.sighting.season).toBeNull();
  });
});
