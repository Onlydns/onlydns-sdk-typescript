/**
 * Base error class for all OnlyDNS SDK errors.
 */
export class OnlyDNSError extends Error {
  public readonly statusCode?: number;
  public readonly details: string[];

  constructor(message: string, statusCode?: number, details: string[] = []) {
    super(
      statusCode
        ? `[${statusCode}] ${message}${details.length > 0 ? ` - Details: ${details.join('; ')}` : ''}`
        : `${message}${details.length > 0 ? ` - Details: ${details.join('; ')}` : ''}`
    );
    this.name = 'OnlyDNSError';
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when API token is missing, invalid, or unauthorized (HTTP 401).
 */
export class AuthenticationError extends OnlyDNSError {
  constructor(message: string = 'Access token is missing or invalid', statusCode: number = 401, details: string[] = []) {
    super(message, statusCode, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Thrown when requested resource (domain/record/key) is not found (HTTP 404).
 */
export class NotFoundError extends OnlyDNSError {
  constructor(message: string = 'Resource not found', statusCode: number = 404, details: string[] = []) {
    super(message, statusCode, details);
    this.name = 'NotFoundError';
  }
}

/**
 * Thrown when request payload fails validation (HTTP 400).
 */
export class ValidationError extends OnlyDNSError {
  constructor(message: string = 'Bad request or invalid parameters', statusCode: number = 400, details: string[] = []) {
    super(message, statusCode, details);
    this.name = 'ValidationError';
  }
}

/**
 * Thrown when OnlyDNS API returns an internal or server error (HTTP 503 / 5xx).
 */
export class APIError extends OnlyDNSError {
  constructor(message: string, statusCode?: number, details: string[] = []) {
    super(message, statusCode, details);
    this.name = 'APIError';
  }
}
