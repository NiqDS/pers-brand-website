/**
 * Minimal in-memory fixed-window rate limiter. Single-process only — fine for a
 * personal deployment. Keyed by IP; used to throttle /subscribe.
 */
const hits = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

  if (recent.length >= max) {
    const oldest = recent[0] ?? now;
    return { allowed: false, retryAfterSeconds: Math.ceil((oldest + windowMs - now) / 1000) };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test helper: clear all recorded hits. */
export function resetRateLimit(): void {
  hits.clear();
}
