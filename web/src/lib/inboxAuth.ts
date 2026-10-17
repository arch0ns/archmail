// ============================================================================
// ANNE TMAIL - Inbox Token Authentication (server-side)
// ============================================================================
// Memverifikasi `Authorization: Bearer <accessToken>` terhadap tabel inboxes
// yang belum kedaluwarsa. Ini inti proteksi IDOR: kepemilikan inbox hanya
// dibuktikan lewat access_token rahasia, bukan alamat email.
// ============================================================================

import type { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { Inbox } from '@/types';

/** Ekstrak token dari header Authorization: Bearer <token>. */
export function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Cari inbox aktif berdasarkan access_token.
 * @returns baris inbox atau null bila token salah / sudah expired.
 */
export async function getActiveInboxByToken(token: string | null): Promise<Inbox | null> {
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('inboxes')
    .select('id, email_address, access_token, created_at, expires_at')
    .eq('access_token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error('getActiveInboxByToken error', error.message);
    return null;
  }
  return (data as Inbox | null) ?? null;
}

/** Helper gabungan: ambil token + validasi inbox. */
export async function authenticateInbox(req: NextRequest): Promise<Inbox | null> {
  return getActiveInboxByToken(extractBearerToken(req));
}