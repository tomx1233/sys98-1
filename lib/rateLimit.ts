import { NextRequest } from "next/server";
interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  if (now - lastSweep > 5 * 60 * 1000) {
    lastSweep = now;
    for (const [k, b] of buckets) {
      if (b.resetAt < now) buckets.delete(k);
    }
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
