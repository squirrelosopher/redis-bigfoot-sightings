import { ValidationError } from '../lib/errors.js';
import { formatIssues } from './schemas.js';

/**
 * Builds middleware that validates part of the request against a Zod schema.
 *
 * The parsed result is attached to `req.validated` rather than written back over
 * `req.query`, which Express 5 exposes as a read only getter.
 *
 * @param {'query' | 'params' | 'body'} source
 * @param {import('zod').ZodType} schema
 */
export function validate(source, schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(
        new ValidationError(`invalid request ${source}`, {
          details: formatIssues(result.error),
        }),
      );
      return;
    }

    req.validated = { ...req.validated, [source]: result.data };
    next();
  };
}
