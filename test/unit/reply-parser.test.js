import { describe, expect, it } from 'vitest';

import {
  parseAggregateReply,
  parseGeoPoint,
  parseSearchReply,
  toFieldMap,
} from '../../src/search/reply-parser.js';

describe('toFieldMap', () => {
  it('pairs fields with values', () => {
    expect(toFieldMap(['id', '1', 'title', 'Sighting'])).toEqual({ id: '1', title: 'Sighting' });
  });

  it('ignores a trailing field without a value', () => {
    expect(toFieldMap(['id', '1', 'title'])).toEqual({ id: '1' });
  });

  it('returns an empty object for anything that is not an array', () => {
    expect(toFieldMap(null)).toEqual({});
    expect(toFieldMap('nonsense')).toEqual({});
  });
});

describe('parseSearchReply', () => {
  it('reads the total and every document', () => {
    const reply = [
      2,
      'sighting:1',
      ['id', '1', 'title', 'First'],
      'sighting:2',
      ['id', '2', 'title', 'Second'],
    ];

    expect(parseSearchReply(reply)).toEqual({
      total: 2,
      documents: [
        { key: 'sighting:1', fields: { id: '1', title: 'First' } },
        { key: 'sighting:2', fields: { id: '2', title: 'Second' } },
      ],
    });
  });

  it('reports a total with no documents when nothing matched', () => {
    expect(parseSearchReply([0])).toEqual({ total: 0, documents: [] });
  });

  it('survives an unexpected reply shape', () => {
    expect(parseSearchReply(null)).toEqual({ total: 0, documents: [] });
    expect(parseSearchReply([])).toEqual({ total: 0, documents: [] });
  });
});

describe('parseAggregateReply', () => {
  it('drops the leading count and maps each row', () => {
    const reply = [2, ['year', '1990', 'count', '4'], ['year', '1991', 'count', '7']];

    expect(parseAggregateReply(reply)).toEqual([
      { year: '1990', count: '4' },
      { year: '1991', count: '7' },
    ]);
  });

  it('returns nothing for an empty reply', () => {
    expect(parseAggregateReply([0])).toEqual([]);
    expect(parseAggregateReply(null)).toEqual([]);
  });
});

describe('parseGeoPoint', () => {
  it('reads the stored longitude,latitude pair', () => {
    expect(parseGeoPoint('-87.4,34.1')).toEqual({ longitude: -87.4, latitude: 34.1 });
  });

  it('returns null for anything unparseable', () => {
    expect(parseGeoPoint('')).toBeNull();
    expect(parseGeoPoint('north,west')).toBeNull();
    expect(parseGeoPoint('-87.4')).toBeNull();
    expect(parseGeoPoint(null)).toBeNull();
    expect(parseGeoPoint(42)).toBeNull();
  });
});
