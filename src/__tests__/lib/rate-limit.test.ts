import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// We need to re-import the module fresh for each test suite to get clean buckets.
// The module has a setInterval for cleanup, which we need to handle.

describe("rate-limit module", () => {
  let rateLimit: typeof import("@/lib/rate-limit").rateLimit;
  let checkRateLimit: typeof import("@/lib/rate-limit").checkRateLimit;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mod = await import("@/lib/rate-limit");
    rateLimit = mod.rateLimit;
    checkRateLimit = mod.checkRateLimit;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("rateLimit", () => {
    it("allows requests within the limit", () => {
      const config = { limit: 3, windowMs: 60_000 };
      const r1 = rateLimit("test-key", config);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);

      const r2 = rateLimit("test-key", config);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);

      const r3 = rateLimit("test-key", config);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);
    });

    it("blocks requests exceeding the limit", () => {
      const config = { limit: 2, windowMs: 60_000 };
      rateLimit("block-key", config);
      rateLimit("block-key", config);

      const r3 = rateLimit("block-key", config);
      expect(r3.allowed).toBe(false);
      expect(r3.remaining).toBe(0);
    });

    it("different keys have independent limits", () => {
      const config = { limit: 1, windowMs: 60_000 };

      const r1 = rateLimit("key-a", config);
      expect(r1.allowed).toBe(true);

      const r2 = rateLimit("key-b", config);
      expect(r2.allowed).toBe(true);

      // key-a should now be blocked
      const r3 = rateLimit("key-a", config);
      expect(r3.allowed).toBe(false);

      // key-b should also be blocked independently
      const r4 = rateLimit("key-b", config);
      expect(r4.allowed).toBe(false);
    });

    it("window resets after expiry", () => {
      const config = { limit: 1, windowMs: 10_000 };

      const r1 = rateLimit("reset-key", config);
      expect(r1.allowed).toBe(true);

      const r2 = rateLimit("reset-key", config);
      expect(r2.allowed).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(10_001);

      const r3 = rateLimit("reset-key", config);
      expect(r3.allowed).toBe(true);
    });

    it("returns correct resetAt timestamp", () => {
      const now = Date.now();
      const config = { limit: 5, windowMs: 30_000 };

      const result = rateLimit("ts-key", config);
      expect(result.resetAt).toBe(now + 30_000);
    });

    it("remaining decreases with each request", () => {
      const config = { limit: 5, windowMs: 60_000 };
      for (let i = 0; i < 5; i++) {
        const result = rateLimit("dec-key", config);
        expect(result.remaining).toBe(4 - i);
      }
    });

    it("remaining stays 0 when blocked", () => {
      const config = { limit: 1, windowMs: 60_000 };
      rateLimit("zero-key", config);

      const r1 = rateLimit("zero-key", config);
      expect(r1.remaining).toBe(0);

      const r2 = rateLimit("zero-key", config);
      expect(r2.remaining).toBe(0);
    });
  });

  describe("checkRateLimit", () => {
    it("returns null when allowed", () => {
      const config = { limit: 5, windowMs: 60_000 };
      const result = checkRateLimit("check-ok", config);
      expect(result).toBeNull();
    });

    it("returns error object when blocked", () => {
      const config = { limit: 1, windowMs: 60_000 };
      checkRateLimit("check-block", config); // uses up the limit (calls rateLimit internally)

      const result = checkRateLimit("check-block", config);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(429);
      expect(result!.error).toMatch(/too many requests/i);
      expect(typeof result!.retryAfter).toBe("number");
      expect(result!.retryAfter).toBeGreaterThan(0);
    });

    it("retryAfter decreases over time", () => {
      const config = { limit: 1, windowMs: 60_000 };
      checkRateLimit("retry-key", config);

      const result1 = checkRateLimit("retry-key", config);
      expect(result1).not.toBeNull();
      const retryAfter1 = result1!.retryAfter;

      // Advance 10 seconds
      vi.advanceTimersByTime(10_000);

      const result2 = checkRateLimit("retry-key", config);
      expect(result2).not.toBeNull();
      const retryAfter2 = result2!.retryAfter;

      expect(retryAfter2).toBeLessThan(retryAfter1);
    });

    it("returns null again after window expires", () => {
      const config = { limit: 1, windowMs: 5_000 };
      checkRateLimit("expire-key", config);

      const blocked = checkRateLimit("expire-key", config);
      expect(blocked).not.toBeNull();

      vi.advanceTimersByTime(5_001);

      const allowed = checkRateLimit("expire-key", config);
      expect(allowed).toBeNull();
    });
  });
});
