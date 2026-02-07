/**
 * Simple in-memory rate limiter using a sliding window.
 * Suitable for single-process SQLite-based deployments.
 */

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now > entry.resetAt) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref();

export type RateLimitConfig = {
  /** Max requests allowed within the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
};

export function rateLimit(
  key: string,
  config: RateLimitConfig,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + config.windowMs };
    buckets.set(key, entry);
  }

  entry.count += 1;

  if (entry.count > config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Convenience: returns a 429 JSON response if rate limited, or null if allowed.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): { error: string; status: 429; retryAfter: number } | null {
  const result = rateLimit(key, config);
  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return {
      error: "Too many requests. Please try again later.",
      status: 429,
      retryAfter,
    };
  }
  return null;
}
