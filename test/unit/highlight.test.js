import { describe, expect, it } from 'vitest';

import { highlightTerms } from '../../src/search/highlight.js';

describe('highlightTerms', () => {
  it('splits text into matched and unmatched runs', () => {
    expect(highlightTerms('a bear ran', ['bear'])).toEqual([
      { text: 'a ', match: false },
      { text: 'bear', match: true },
      { text: ' ran', match: false },
    ]);
  });

  it('handles a match at either end', () => {
    expect(highlightTerms('bear', ['bear'])).toEqual([{ text: 'bear', match: true }]);

    expect(highlightTerms('the bear', ['bear'])).toEqual([
      { text: 'the ', match: false },
      { text: 'bear', match: true },
    ]);
  });

  it('marks every occurrence of every term', () => {
    expect(highlightTerms('bear by the river, bear again', ['bear', 'river'])).toEqual([
      { text: 'bear', match: true },
      { text: ' by the ', match: false },
      { text: 'river', match: true },
      { text: ', ', match: false },
      { text: 'bear', match: true },
      { text: ' again', match: false },
    ]);
  });

  it('matches regardless of case', () => {
    expect(highlightTerms('A BEAR', ['bear'])).toEqual([
      { text: 'A ', match: false },
      { text: 'BEAR', match: true },
    ]);
  });

  it('marks a stemmed form, because the index matched the document on one', () => {
    // The query engine stems, so a search for "river" genuinely returns reports
    // that only say "rivers". Leaving those unmarked would look like a bug.
    expect(highlightTerms('two rivers', ['river'])).toEqual([
      { text: 'two ', match: false },
      { text: 'rivers', match: true },
    ]);
  });

  it('only matches at a word boundary', () => {
    expect(highlightTerms('downriver', ['river'])).toEqual([{ text: 'downriver', match: false }]);
  });

  it('treats text with no match as a single unmatched run', () => {
    expect(highlightTerms('nothing matched', ['bear'])).toEqual([
      { text: 'nothing matched', match: false },
    ]);
  });

  it('returns a single unmatched run when no terms were searched for', () => {
    expect(highlightTerms('a bear ran', [])).toEqual([{ text: 'a bear ran', match: false }]);
    expect(highlightTerms('a bear ran')).toEqual([{ text: 'a bear ran', match: false }]);
  });

  it('returns nothing for absent or empty text', () => {
    expect(highlightTerms(null, ['bear'])).toEqual([]);
    expect(highlightTerms(undefined, ['bear'])).toEqual([]);
    expect(highlightTerms('', ['bear'])).toEqual([]);
  });

  it('treats a term with regular expression syntax as literal text', () => {
    // Terms reach this function already reduced to alphanumerics, but the
    // function must not depend on its caller for that.
    expect(highlightTerms('a (bear) ran', ['(bear)'])).toEqual([
      { text: 'a (bear) ran', match: false },
    ]);

    expect(() => highlightTerms('anything', ['*'])).not.toThrow();
  });

  it('always reproduces the original text when the segments are joined', () => {
    const text = 'A bear, two rivers and a Bear cub.';
    const segments = highlightTerms(text, ['bear', 'river']);

    expect(segments.map((segment) => segment.text).join('')).toBe(text);
  });
});
