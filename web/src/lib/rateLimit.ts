// ============================================================================
// ANNE TMAIL - In-Memory IP Rate Limiter
// ============================================================================
// Batasan: state disimpan per-instance serverless. Pada lingkungan multi
// instance (Vercel) nilai bisa ter-reset / tidak akurat sempurna. Untuk
// produksi skala besar, ganti dengan Upstash Redis / durable store.
// ============================================================================

import type { NextRequest } from 'next/server';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const MAX_KEYS = 5000; // batas memori
let lastSweep = 0;

/** Bersihkan bucket kadaluarsa secara berkala. */
function sweep(now: number): void {
  if (now - lastSweep < 30_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Jika masih terlalu banyak, buang yang paling tua.
  if (buckets.size > MAX_KEYS) {
    const excess = buckets.size - MAX_KEYS;
    let i = 0;
    for (const key of buckets.keys()) {
      if (i++ >= excess) break;
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

/**
 * Cek & tambah hitungan untuk key tertentu.
 * @param key      identitas (mis. `inbox:${ip}`)
 * @param limit    jumlah maksimum request per window
 * @param windowMs panjang window dalam milidetik
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetAt,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/** Ambil IP klien dari request (fallback ke x-real-ip / unknown). */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('cf-connecting-ip') ??
    'unknown'
  );
}

/** Batas rate limit terpusat. */
export const RATE_LIMITS = {
  CREATE_INBOX: { limit: 10, windowMs: 60_000 },   // 10 / menit
  READ_EMAILS: { limit: 60, windowMs: 60_000 },    // 60 / menit
} as const;