/**
 * Application error carrying an HTTP-style status and a stable machine code.
 * Services throw these; REST maps them to responses, MCP maps them to tool errors.
 */
export class AppError extends Error {
  /**
   * @param {number} status HTTP status
   * @param {string} code stable machine-readable code
   * @param {string} message safe, human-readable message
   * @param {unknown} [details] safe structured details
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Authentication required') => new AppError(401, 'UNAUTHENTICATED', message);
export const forbidden = (code, message) => new AppError(403, code, message);
// Resources owned by another user are reported as 404 so existence is not leaked.
export const notFound = (what) => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (code, message, details) => new AppError(409, code, message, details);
export const unprocessable = (code, message, details) => new AppError(422, code, message, details);
