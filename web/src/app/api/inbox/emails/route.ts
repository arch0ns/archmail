// ============================================================================
// GET /api/inbox/emails
// Header: Authorization: Bearer <accessToken>
// Mengembalikan daftar email inbox (tanpa body besar).
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authenticateInbox } from '@/lib/inboxAuth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import type { EmailListItem } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`read-emails:${ip}`, RATE_LIMITS.READ_EMAILS.limit, RATE_LIMITS.READ_EMAILS.windowMs);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
      );
    }

    const inbox = await authenticateInbox(req);
    if (!inbox) {
      return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('emails')
      .select(
        'id, inbox_id, sender_name, sender_address, recipient, subject, otp_code, is_read, has_attachments, created_at',
      )
      .eq('inbox_id', inbox.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('GET /api/inbox/emails error', error.message);
      return NextResponse.json({ error: 'Gagal memuat email.' }, { status: 500 });
    }

    return NextResponse.json({
      emails: (data ?? []) as EmailListItem[],
      expiresAt: inbox.expires_at,
    });
  } catch (err) {
    console.error('GET /api/inbox/emails exception', err);
    return NextResponse.json({ error: 'Kesalahan server.' }, { status: 500 });
  }
}