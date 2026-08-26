import { ApplicationError, isUpstreamUnavailable } from '../lib/errors.js';

/**
 * Error responses follow RFC 9457 (problem details for HTTP APIs), so clients
 * get a predictable, machine readable body instead of an HTML stack trace.
 */

const DEFAULT_STATUS = 500;

/**
 * Titles for failures that did not originate as an ApplicationError. These are
 * deliberately derived from the status rather than from the error itself, so an
 * internal code such as ECONNREFUSED never becomes part of the response.
 */
const TITLE_BY_STATUS = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_allowed',
  413: 'payload_too_large',
  415: 'unsupported_media_type',
  500: 'internal_error',
  503: 'service_unavailable',
};

const SERVER_ERROR_DETAIL = {
  500: 'the request could not be processed',
  503: 'the search backend is temporarily unavailable, please retry',
};

function resolveStatus(error) {
  if (error instanceof ApplicationError) {
    return error.status;
  }

  // A Redis outage is transient, so it is reported as 503 rather than 500:
  // clients and proxies treat the former as worth retrying.
  if (isUpstreamUnavailable(error)) {
    return 503;
  }

  const status = Number(error?.status ?? error?.statusCode);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : DEFAULT_STATUS;
}

/** Terminal middleware for requests that matched no route. */
export function notFoundHandler(req, res, next) {
  next(
    new ApplicationError(`no route for ${req.method} ${req.originalUrl}`, {
      status: 404,
      code: 'not_found',
    }),
  );
}

/**
 * @param {import('pino').Logger} logger
 */
export function createErrorHandler(logger) {
  // Express identifies error handlers by arity, so `next` has to stay.
  // eslint-disable-next-line no-unused-vars
  return function errorHandler(error, req, res, next) {
    const status = resolveStatus(error);

    if (status >= 500) {
      logger.error({ err: error, url: req.originalUrl }, 'request failed');
    } else {
      logger.warn({ err: error, url: req.originalUrl }, 'request rejected');
    }

    // Once the response has started there is nothing useful left to send.
    if (res.headersSent) {
      res.destroy();
      return;
    }

    const isServerError = status >= 500;

    const title =
      error instanceof ApplicationError
        ? error.code
        : (TITLE_BY_STATUS[status] ?? (isServerError ? 'internal_error' : 'request_error'));

    res
      .status(status)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        title,
        status,
        // Internal failure messages can leak implementation detail, so server
        // side faults get a generic detail and the full error is only logged.
        detail: isServerError
          ? (SERVER_ERROR_DETAIL[status] ?? SERVER_ERROR_DETAIL[500])
          : error.message,
        ...(error.details ? { errors: error.details } : {}),
      });
  };
}
