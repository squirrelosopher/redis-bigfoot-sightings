/**
 * Highlighting is expressed as structured `{ text, match }` segments rather than
 * markup: the API never returns tags assembled from user generated content, so
 * report text drawn from a public data set cannot introduce markup into a page.
 *
 * RediSearch can delimit matches itself via `HIGHLIGHT ... TAGS`, but it refuses
 * both `HIGHLIGHT` and `SUMMARIZE` on a JSON index, so the terms are matched
 * here instead.
 */

/**
 * @typedef {{text: string, match: boolean}} HighlightSegment
 */

/** @param {string} value */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Marks each occurrence of a search term in `value`.
 *
 * Terms match at a word boundary and may run on, so a search for "river" also
 * marks "rivers" - the index stems, so those documents are genuine hits and
 * leaving them unmarked looks like a bug. The trade is that a longer word which
 * merely starts the same way ("riverside") is marked too.
 *
 * The concatenated segment texts always reproduce the input exactly, so callers
 * can rebuild the original string from them.
 *
 * @param {unknown} value
 * @param {string[]} [terms]
 * @returns {HighlightSegment[]}
 */
export function highlightTerms(value, terms = []) {
  if (value === null || value === undefined) {
    return [];
  }

  const text = String(value);

  if (text.length === 0) {
    return [];
  }

  const unique = [...new Set(terms.map((term) => String(term)).filter((term) => term.length > 0))];

  if (unique.length === 0) {
    return [{ text, match: false }];
  }

  const pattern = new RegExp(`\\b(?:${unique.map(escapeRegExp).join('|')})\\w*`, 'giu');
  const segments = [];
  let index = 0;

  for (const match of text.matchAll(pattern)) {
    if (match.index > index) {
      segments.push({ text: text.slice(index, match.index), match: false });
    }

    segments.push({ text: match[0], match: true });
    index = match.index + match[0].length;
  }

  if (index < text.length) {
    segments.push({ text: text.slice(index), match: false });
  }

  return segments.length > 0 ? segments : [{ text, match: false }];
}
