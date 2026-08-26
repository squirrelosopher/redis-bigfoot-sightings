import { describe, expect, it } from 'vitest';

import {
  buildGeoClause,
  buildSearchQuery,
  escapeTagValue,
  toSearchTerms,
} from '../../src/search/query-builder.js';

describe('escapeTagValue', () => {
  it('escapes the characters RediSearch treats as syntax', () => {
    expect(escapeTagValue('St. Louis')).toBe('St\\.\\ Louis');
    expect(escapeTagValue('Prince George-s')).toBe('Prince\\ George\\-s');
  });

  it('escapes the escape character itself', () => {
    const backslash = String.fromCharCode(92);

    expect(escapeTagValue('a' + backslash + 'b')).toBe('a' + backslash + backslash + 'b');
  });

  it('leaves plain values untouched', () => {
    expect(escapeTagValue('Washington')).toBe('Washington');
  });
});

describe('toSearchTerms', () => {
  it('splits on anything that is not a letter or a digit', () => {
    expect(toSearchTerms('river bear')).toEqual(['river', 'bear']);
    expect(toSearchTerms('  river,  bear! ')).toEqual(['river', 'bear']);
  });

  it('keeps non ascii letters', () => {
    expect(toSearchTerms('reka medved')).toEqual(['reka', 'medved']);
  });

  it('returns nothing for absent or punctuation only input', () => {
    expect(toSearchTerms(null)).toEqual([]);
    expect(toSearchTerms(undefined)).toEqual([]);
    expect(toSearchTerms('   ')).toEqual([]);
    expect(toSearchTerms('***')).toEqual([]);
  });
});

describe('buildSearchQuery', () => {
  it('matches everything when no criteria are supplied', () => {
    expect(buildSearchQuery()).toBe('*');
    expect(buildSearchQuery({})).toBe('*');
  });

  it('does not emit the string "null" for absent text', () => {
    // The previous implementation concatenated `null` into the query and then
    // tried to strip it back out with a string replace.
    expect(buildSearchQuery({ state: 'Alabama' })).toBe('@state:{Alabama}');
    expect(buildSearchQuery({ state: 'Alabama' })).not.toContain('null');
  });

  it('intersects a single term with tag filters', () => {
    expect(buildSearchQuery({ text: 'bear', state: 'Ohio', county: 'Athens' })).toBe(
      'bear @state:{Ohio} @county:{Athens}',
    );
  });

  it('groups multiple terms', () => {
    expect(buildSearchQuery({ text: 'river bear' })).toBe('(river bear)');
  });

  it('appends a geo clause when the centre and radius are complete', () => {
    expect(buildSearchQuery({ longitude: -110, latitude: 55, radius: 500, units: 'mi' })).toBe(
      '@location:[-110 55 500 mi]',
    );
  });

  describe('untrusted input', () => {
    it('drops operators from free text instead of letting them alter the query', () => {
      const query = buildSearchQuery({ text: '@state:{Ohio} | *' });

      expect(query).toBe('(state Ohio)');
      expect(query).not.toContain('@state:');
      expect(query).not.toContain('|');
    });

    it('escapes tag values so a closing brace cannot end the clause', () => {
      const query = buildSearchQuery({ state: 'Ohio} | @county:{Athens' });

      expect(query).toBe('@state:{Ohio\\}\\ \\|\\ \\@county\\:\\{Athens}');

      // The injected brace is escaped, so the clause still has exactly one
      // opening and one closing delimiter of its own.
      expect(query.match(/(?<!\\)\{/g)).toHaveLength(1);
      expect(query.match(/(?<!\\)\}/g)).toHaveLength(1);
    });

    it('never lets text turn into a wildcard match', () => {
      // Text that reduces to no usable terms cannot be honoured, and dropping
      // the clause would leave a broader search than was asked for: a match-all
      // on its own, and every Ohio report next to a tag filter. There is no
      // RediSearch expression for "match nothing", so the builder says so with
      // null and the service skips the round trip.
      expect(buildSearchQuery({ text: '*' })).toBeNull();
      expect(buildSearchQuery({ text: '"|-+~' })).toBeNull();
      expect(buildSearchQuery({ text: '*', state: 'Ohio' })).toBeNull();
    });

    it('still matches everything when no text was supplied at all', () => {
      // Blank is absent, not unusable: an empty search box is not a filter.
      expect(buildSearchQuery({})).toBe('*');
      expect(buildSearchQuery({ text: '' })).toBe('*');
      expect(buildSearchQuery({ text: '   ' })).toBe('*');
    });
  });
});

describe('buildGeoClause', () => {
  it('requires all three of longitude, latitude and radius', () => {
    expect(buildGeoClause({ longitude: -110, latitude: 55 })).toBeNull();
    expect(buildGeoClause({ longitude: -110, radius: 10 })).toBeNull();
    expect(buildGeoClause({ latitude: 55, radius: 10 })).toBeNull();
  });

  it('rejects coordinates outside the projected world', () => {
    expect(buildGeoClause({ longitude: 200, latitude: 55, radius: 10 })).toBeNull();
    expect(buildGeoClause({ longitude: -110, latitude: 90, radius: 10 })).toBeNull();
  });

  it('rejects a non positive radius', () => {
    expect(buildGeoClause({ longitude: -110, latitude: 55, radius: 0 })).toBeNull();
    expect(buildGeoClause({ longitude: -110, latitude: 55, radius: -5 })).toBeNull();
  });

  it('rejects unsupported units', () => {
    expect(
      buildGeoClause({ longitude: -110, latitude: 55, radius: 10, units: 'parsec' }),
    ).toBeNull();
  });

  it('rejects values that are not numbers', () => {
    expect(buildGeoClause({ longitude: '-110', latitude: 55, radius: 10 })).toBeNull();
    expect(buildGeoClause({ longitude: Number.NaN, latitude: 55, radius: 10 })).toBeNull();
  });

  it('defaults to kilometres', () => {
    expect(buildGeoClause({ longitude: -110, latitude: 55, radius: 10 })).toBe(
      '@location:[-110 55 10 km]',
    );
  });
});
