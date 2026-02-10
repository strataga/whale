/**
 * #25 Simple in-memory TTL cache for hot paths.
 * No Redis needed for single-process SQLite deployments.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

// Periodically clean expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) store.delete(key);
  }
}, 60_000).unref();

/**
 * Get a cached value, or compute and cache it.
 * @param key Cache key
 * @param ttlMs Time-to-live in milliseconds
 * @param compute Function to compute value if missing/expired
 */
export function cacheGet<T>(key: string, ttlMs: number, compute: () => T): T {
  const now = Date.now();
  const existing = store.get(key) as CacheEntry<T> | undefined;

  if (existing && now < existing.expiresAt) {
    return existing.value;
  }

  const value = compute();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/**
 * Invalidate a single cache key.
 */
export function invalidateCache(key: string): void {
  store.delete(key);
}

/**
 * Invalidate all keys matching a prefix.
 */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * Clear entire cache.
 */
export function clearCache(): void {
  store.clear();
}
