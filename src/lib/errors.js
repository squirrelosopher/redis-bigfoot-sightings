/**
 * Application level errors carrying the HTTP status the API should report.
 * Keeping the status on the error lets the service layer stay unaware of
 * Express while still expressing intent ("this was not found", "the upstream is
 * unavailable") rather than leaking raw exceptions to the client.
 */

export class ApplicationError extends Error {
  /**
   * @param {string} message
   * @param {{status?: number, code?: string, cause?: unknown, details?: unknown}} [options]
   */
  constructor(message, { status = 500, code = 'internal_error', cause, details } = {}) {
    super(message, { cause });
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
    this.expected = status < 500;
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message = 'resource not found', options = {}) {
    super(message, { status: 404, code: 'not_found', ...options });
  }
}

export class ValidationError extends ApplicationError {
  constructor(message = 'request validation failed', options = {}) {
    super(message, { status: 400, code: 'validation_failed', ...options });
  }
}

/** Socket level failures ioredis surfaces when the server cannot be reached. */
const UPSTREAM_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'EPIPE',
]);

const UPSTREAM_ERROR_NAMES = new Set(['MaxRetriesPerRequestError', 'ClusterAllFailedError']);

/**
 * Whether a failure means "Redis is not reachable right now" as opposed to
 * "this request was wrong". The distinction matters to callers: 503 invites a
 * retry, 500 does not.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isUpstreamUnavailable(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (
    UPSTREAM_ERROR_CODES.has(error.code) ||
    UPSTREAM_ERROR_NAMES.has(error.name) ||
    error.message === 'Connection is closed.'
  );
}
