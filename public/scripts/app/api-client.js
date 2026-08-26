/**
 * Thin wrapper over the REST API.
 *
 * Every failure is normalised into an `ApiError` carrying the server's RFC 9457
 * problem detail, so callers have one thing to catch and one place to read the
 * message from.
 */

export class ApiError extends Error {
  constructor(message, { status, problem } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }
}

async function request(path, params) {
  const url = new URL(path, window.location.origin);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!response.ok) {
    let problem = null;

    try {
      problem = await response.json();
    } catch {
      // A non JSON error body is not worth reporting on its own.
    }

    throw new ApiError(problem?.detail ?? `request failed with status ${response.status}`, {
      status: response.status,
      problem,
    });
  }

  return response.json();
}

/** @param {Record<string, string | number | undefined>} criteria */
export function searchSightings(criteria) {
  return request('/api/sightings', criteria);
}

/** @param {number | string} id */
export function getSighting(id) {
  return request(`/api/sightings/${encodeURIComponent(id)}`);
}

export function getFacets() {
  return request('/api/facets');
}
