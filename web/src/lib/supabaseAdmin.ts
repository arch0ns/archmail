// ============================================================================
// ANNE TMAIL - Supabase Admin Client (SERVICE ROLE)
// ============================================================================
// HANYA untuk dipakai di server (API routes / server actions).
// Memakai SERVICE_ROLE_KEY yang mem-bypass RLS. Jangan pernah mengimpor file
// ini dari komponen client.
// ============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/** Ambil (dan cache) Supabase admin client. */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase admin tidak terkonfigurasi: set NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}

/** Nama bucket privat untuk lampiran email. */
export const ATTACHMENTS_BUCKET = 'email-attachments';

/** Masa berlaku Signed URL (detik). */
export const SIGNED_URL_TTL = 600; // 10 menit