// ============================================
// RATE LIMITER
// Prevents hitting API rate limits
// ============================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();

  /** Check if request is allowed */
  async checkLimit(key: string, maxRequests: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      // Reset window
      this.store.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return true;
    }

    if (entry.count >= maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  /** Wait until rate limit resets */
  async waitForReset(key: string): Promise<void> {
    const entry = this.store.get(key);
    if (!entry) return;

    const waitTime = entry.resetTime - Date.now();
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime + 100));
    }
  }

  /** Get current usage */
  getUsage(key: string): { count: number; remaining: number; resetIn: number } {
    const entry = this.store.get(key);
    if (!entry) {
      return { count: 0, remaining: Infinity, resetIn: 0 };
    }
    return {
      count: entry.count,
      remaining: Math.max(0, Infinity), // Will be set per-endpoint
      resetIn: Math.max(0, entry.resetTime - Date.now()),
    };
  }
}

export const rateLimiter = new RateLimiter();
