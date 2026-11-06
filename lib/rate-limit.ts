import { createHmac } from "crypto"

interface Bucket {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

const CLEANUP_MS = 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > CLEANUP_MS) buckets.delete(key);
  }
}, CLEANUP_MS);

function hmacKey(seed: string): string {
  const secret = process.env.RATE_LIMIT_SECRET || process.env.SESSION_SECRET || ""
  if (!secret) return seed
  return createHmac("sha256", secret).update(seed).digest("hex").slice(0, 16)
}

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const hashedKey = hmacKey(key)
  const bucket = buckets.get(hashedKey);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(hashedKey, { windowStart: now, count: 1 });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterMs: windowMs - (now - bucket.windowStart) };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : (req.headers.get("x-real-ip") ?? "unknown");
  return hmacKey(`ip:${ip}`)
}

export function rateLimited(req: Request, route: string, limit: number, windowMs: number): boolean {
  const ip = clientIp(req);
  return !rateLimit(`${route}:${ip}`, limit, windowMs).allowed;
}
