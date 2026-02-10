/**
 * #23 Error type hierarchy for consistent API responses.
 */

import { NextResponse } from "next/server";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} '${id}' not found` : `${resource} not found`,
      404,
      "NOT_FOUND",
    );
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super("Too many requests. Please try again later.", 429, "RATE_LIMIT");
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/**
 * Map any error to a consistent JSON API response.
 */
export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    const body: Record<string, unknown> = {
      error: err.message,
      code: err.code,
    };
    if (err.details !== undefined) body.details = err.details;
    const headers: Record<string, string> = {};
    if (err instanceof RateLimitError) {
      headers["Retry-After"] = String(err.retryAfter);
    }
    return NextResponse.json(body, { status: err.statusCode, headers });
  }

  // ZodError
  if (err && typeof err === "object" && "issues" in err) {
    return NextResponse.json(
      { error: "Invalid request body", code: "VALIDATION_ERROR", details: (err as { issues: unknown }).issues },
      { status: 400 },
    );
  }

  // Unknown error
  console.error("[handleRouteError] Unhandled error:", err);
  return NextResponse.json(
    { error: "Internal server error", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}
