/**
 * RediSearch replies are flat arrays whose meaning depends on position. Parsing
 * them here, once, keeps positional indexing out of the rest of the codebase:
 * every layer above works with named fields instead of `row[3]`.
 */

/**
 * Turns a flat `[field, value, field, value]` array into an object.
 * @param {unknown} pairs
 * @returns {Record<string, string>}
 */
export function toFieldMap(pairs) {
  const fields = {};

  if (!Array.isArray(pairs)) {
    return fields;
  }

  for (let index = 0; index + 1 < pairs.length; index += 2) {
    fields[String(pairs[index])] = pairs[index + 1];
  }

  return fields;
}

/**
 * ioredis 6 negotiates RESP3 by default, and under RESP3 the query engine
 * answers `FT.SEARCH` / `FT.AGGREGATE` with a map rather than the positional
 * array below. ioredis surfaces that map as a flat `[key, value, ...]` array
 * shaped like:
 *
 * `['attributes', [], 'format', 'STRING', 'results', [...], 'total_results', 136, 'warning', []]`
 *
 * Read positionally, `'attributes'` becomes the total (`NaN` → 0) and the
 * remaining entries pair up into phantom documents, so every search silently
 * returned `total: 0`. Detect that shape instead of assuming a protocol; a RESP2
 * reply starts with the numeric total and is passed through unchanged.
 *
 * @param {unknown} reply
 * @returns {Record<string, unknown> | null} the map, or null when not RESP3
 */
function asResp3Reply(reply) {
  if (!Array.isArray(reply) || typeof reply[0] !== 'string') {
    return null;
  }

  const fields = toFieldMap(reply);

  return Array.isArray(fields.results) && 'total_results' in fields ? fields : null;
}

/**
 * Parses an `FT.SEARCH` reply, in either the RESP2 form
 * `[total, key, [field, value, ...], key, [field, value, ...], ...]` or the
 * RESP3 map described on {@link asResp3Reply}.
 *
 * @param {unknown} reply
 * @returns {{total: number, documents: Array<{key: string, fields: Record<string, string>}>}}
 */
export function parseSearchReply(reply) {
  if (!Array.isArray(reply) || reply.length === 0) {
    return { total: 0, documents: [] };
  }

  const resp3 = asResp3Reply(reply);

  if (resp3) {
    return {
      total: Number(resp3.total_results) || 0,
      documents: /** @type {unknown[]} */ (resp3.results).map((result) => {
        const row = toFieldMap(result);

        return {
          key: row.id === undefined ? '' : String(row.id),
          fields: toFieldMap(row.extra_attributes),
        };
      }),
    };
  }

  const [total, ...rest] = reply;
  const documents = [];

  for (let index = 0; index + 1 < rest.length; index += 2) {
    documents.push({
      key: String(rest[index]),
      fields: toFieldMap(rest[index + 1]),
    });
  }

  return { total: Number(total) || 0, documents };
}

/**
 * Parses an `FT.AGGREGATE` reply, in either the RESP2 form
 * `[total, [field, value, ...], [field, value, ...], ...]` or the RESP3 map
 * described on {@link asResp3Reply}, whose rows nest their values under
 * `extra_attributes`.
 *
 * @param {unknown} reply
 * @returns {Array<Record<string, string>>}
 */
export function parseAggregateReply(reply) {
  if (!Array.isArray(reply) || reply.length === 0) {
    return [];
  }

  const resp3 = asResp3Reply(reply);

  if (resp3) {
    return /** @type {unknown[]} */ (resp3.results).map((row) =>
      toFieldMap(toFieldMap(row).extra_attributes),
    );
  }

  const [, ...rows] = reply;
  return rows.filter(Array.isArray).map(toFieldMap);
}

/**
 * Parses the `"longitude,latitude"` string RediSearch stores for GEO fields.
 * @param {unknown} value
 * @returns {{longitude: number, latitude: number} | null}
 */
export function parseGeoPoint(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const [longitude, latitude] = value.split(',').map(Number);

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }

  return { longitude, latitude };
}
