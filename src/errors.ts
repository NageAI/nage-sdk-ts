/** Base error for all Nage SDK errors. */
export class NageError extends Error {
  statusCode?: number;
  body?: Record<string, any>;

  constructor(message: string, statusCode?: number, body?: Record<string, any>) {
    super(message);
    this.name = "NageError";
    this.statusCode = statusCode;
    this.body = body;
  }
}

/** Invalid or missing API key. */
export class AuthError extends NageError {
  constructor(message = "Invalid or missing API key") {
    super(message, 401);
    this.name = "AuthError";
  }
}

/** STRATUM rate limit exceeded. */
export class RateLimitError extends NageError {
  limit?: number;
  used?: number;

  constructor(message: string, limit?: number, used?: number) {
    super(message, 429);
    this.name = "RateLimitError";
    this.limit = limit;
    this.used = used;
  }
}

/** Server error. */
export class ServerError extends NageError {
  constructor(message = "Server error") {
    super(message, 500);
    this.name = "ServerError";
  }
}
