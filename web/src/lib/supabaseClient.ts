// ============================================================================
// ANNE TMAIL - Supabase Public Client (anon key) + Realtime token
// ============================================================================
// Dipakai di browser. Tunduk pada RLS.
// Untuk Realtime, kita sertakan header `x-inbox-token` agar policy RLS
// (emails_read_with_valid_token) dapat memverifikasi kepemilikan inbox.
// ============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Buat Supabase client browser dengan header realtime opsional.
 * Setiap token berbeda sebaiknya memakai client baru agar header WS ter-set.
 */
export function createBrowserSupabaseClient(inboxToken?: string): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase belum dikonfigurasi: set NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: {
      params: { eventsPerSecond: 10 },
      // Header ini diteruskan ke koneksi Realtime WebSocket sehingga
      // policy RLS berbasis request.headers dapat bekerja.
      headers: inboxToken ? { 'x-inbox-token': inboxToken } : undefined,
    },
  });
}