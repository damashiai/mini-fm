/**
 * Tiny in-memory sliding-window rate limiter for cheap anonymous endpoints
 * (mood generation fans out to Jev + DB on every request with no auth).
 *
 * NOTE: this is per-instance memory, so it only fits a single-region /
 * low-traffic deploy. If traffic grows, swap the Map for Redis/Upstash:
 * replace `hit()` internals with `INCR` + `EXPIRE` on a per-key counter —
 * the call sites (`isRateLimited(key)`) stay the same.
 */
const windows = new Map<string, number[]>();

export function isRateLimited(
  key: string,
  limit = 10,
  windowMs = 10 * 60 * 1000,
): { limited: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (windows.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    return {
      limited: true,
      retryAfterSec: Math.ceil((oldest + windowMs - now) / 1000),
    };
  }
  hits.push(now);
  // Opportunistic cleanup so the map can't grow unbounded.
  if (windows.size > 10_000) {
    for (const [k, v] of windows) {
      if (v.length === 0 || v[v.length - 1]! < cutoff) windows.delete(k);
    }
  }
  windows.set(key, hits);
  return { limited: false, retryAfterSec: 0 };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
