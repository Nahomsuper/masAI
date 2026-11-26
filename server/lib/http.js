/** An error that carries an HTTP status and a machine-readable code. */
export class ApiError extends Error {
  constructor(status, message, code = 'error', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new ApiError(400, message, 'bad_request', details);
export const unauthorized = (message = 'Sign in to continue') => new ApiError(401, message, 'unauthorized');
export const notFound = (message = 'Not found') => new ApiError(404, message, 'not_found');

/** Wraps an async route handler so rejections reach the error middleware. */
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

/** Express error middleware: always answers with `{ error, code }`. */
export function errorMiddleware(error, _req, res, _next) {
  const status = error instanceof ApiError ? error.status : 500;
  const code = error instanceof ApiError ? error.code : 'server_error';
  if (status >= 500) {
    console.error('[api]', error);
  }
  res.status(status).json({
    error: error instanceof ApiError ? error.message : 'Something went wrong on the server',
    code,
    details: error.details,
  });
}

/** Reads a required trimmed string from a body object. */
export function requireString(body, field, { max = 500 } = {}) {
  const value = typeof body?.[field] === 'string' ? body[field].trim() : '';
  if (!value) throw badRequest(`${field} is required`, { field });
  if (value.length > max) throw badRequest(`${field} must be under ${max} characters`, { field });
  return value;
}

/** Reads an optional trimmed string. */
export function optionalString(body, field, max = 500) {
  const value = body?.[field];
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, max);
}

/** Reads an optional finite number. */
export function optionalNumber(body, field) {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw badRequest(`${field} must be a number`, { field });
  return parsed;
}
