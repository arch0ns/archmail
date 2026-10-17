// ============================================================================
// POST   /api/inbox  - buat inbox baru (validasi + blocklist + rate limit)
// DELETE /api/inbox  - hapus inbox + seluruh lampiran (butuh access token)
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { authenticateInbox } from '@/lib/inboxAuth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { removeInboxStorage } from '@/lib/storageCleanup';
import { normalizeUsername, validateUsername } from '@/lib/usernameValidator';
import { generateRandomUsername } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INBOX_TTL_MINUTES = 30;

interface CreateInboxBody {
  username?: string;
  domain?: string;
  randomDomain?: boolean;
}

function badRequest(error: string, status = 400, details?: string) {
  return NextResponse.json({ error, details }, { status });
}

// ---------------------------------------------------------------------------
// POST: buat inbox
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    // Rate limit per IP.
    const ip = getClientIp(req);
    const rl = checkRateLimit(`create-inbox:${ip}`, RATE_LIMITS.CREATE_INBOX.limit, RATE_LIMITS.CREATE_INBOX.windowMs);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak permintaan. Coba lagi sebentar.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
      );
    }

    let body: CreateInboxBody = {};
    try {
      body = (await req.json()) as CreateInboxBody;
    } catch {
      body = {};
    }

    // Ambil daftar domain aktif.
    const supabase = getSupabaseAdmin();
    const { data: domains, error: domainsError } = await supabase
      .from('domains')
      .select('domain_name')
      .eq('is_active', true);

    if (domainsError) {
      console.error('POST /api/inbox domains error', domainsError.message);
      return badRequest('Gagal memuat domain.', 500);
    }
    if (!domains || domains.length === 0) {
      return badRequest('Belum ada domain aktif. Hubungi admin.', 503);
    }

    const activeDomains = domains.map((d) => d.domain_name as string);

    // Pilih domain: random bila diminta / tidak dipilih.
    let domain: string;
    if (body.randomDomain === true || !body.domain) {
      domain = activeDomains[Math.floor(Math.random() * activeDomains.length)];
    } else {
      const requested = body.domain.trim().toLowerCase();
      if (!activeDomains.includes(requested)) {
        return badRequest('Domain tidak valid atau tidak aktif.');
      }
      domain = requested;
    }

    // Tentukan username.
    let username: string;
    const rawUsername = typeof body.username === 'string' ? body.username : '';
    if (rawUsername.trim().length === 0) {
      username = generateRandomUsername(9);
    } else {
      const result = validateUsername(rawUsername);
      if (!result.valid) {
        return badRequest(result.reason ?? 'Username tidak valid.');
      }
      username = result.normalized;
    }

    const emailAddress = `${username}@${domain}`;

    // Cegah hijack: tolak bila ada inbox aktif dengan alamat sama.
    const nowIso = new Date().toISOString();
    const { data: existing, error: existingError } = await supabase
      .from('inboxes')
      .select('id, expires_at')
      .eq('email_address', emailAddress);

    if (existingError) {
      console.error('POST /api/inbox existing check error', existingError.message);
    }

    const activeExisting = (existing ?? []).some((row) => row.expires_at > nowIso);
    if (activeExisting) {
      return badRequest('Alamat email ini sedang aktif. Coba beberapa saat lagi atau pilih nama lain.', 409);
    }

    // Bersihkan baris expired dengan alamat sama (agar unique index tidak bentrok).
    if (existing && existing.length > 0) {
      const expiredIds = existing.map((row) => row.id as string);
      for (const id of expiredIds) {
        await removeInboxStorage(id);
      }
      await supabase.from('inboxes').delete().in('id', expiredIds);
    }

    // Buat token & expiry.
    const accessToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INBOX_TTL_MINUTES * 60 * 1000).toISOString();

    const { data: inserted, error: insertError } = await supabase
      .from('inboxes')
      .insert({
        email_address: emailAddress,
        access_token: accessToken,
        expires_at: expiresAt,
      })
      .select('id, email_address, expires_at')
      .single();

    if (insertError || !inserted) {
      console.error('POST /api/inbox insert error', insertError?.message);
      return badRequest('Gagal membuat inbox.', 500);
    }

    return NextResponse.json(
      {
        inboxId: inserted.id,
        emailAddress: inserted.email_address,
        accessToken,
        expiresAt: inserted.expires_at,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('POST /api/inbox exception', err);
    return badRequest('Kesalahan server.', 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE: hapus inbox + lampiran
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  try {
    const inbox = await authenticateInbox(req);
    if (!inbox) {
      return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
    }

    // Hapus file storage lebih dulu, baru baris (cascade email & attachment).
    await removeInboxStorage(inbox.id);

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('inboxes').delete().eq('id', inbox.id);
    if (error) {
      console.error('DELETE /api/inbox error', error.message);
      return NextResponse.json({ error: 'Gagal menghapus inbox.' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('DELETE /api/inbox exception', err);
    return NextResponse.json({ error: 'Kesalahan server.' }, { status: 500 });
  }
}