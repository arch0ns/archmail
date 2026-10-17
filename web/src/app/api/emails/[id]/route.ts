// ============================================================================
// GET    /api/emails/[id] - detail email + signed URL + sanitasi + cid
// PATCH  /api/emails/[id] - tandai read/unread
// DELETE /api/emails/[id] - hapus email + lampirannya
// Header: Authorization: Bearer <accessToken>
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import {
  ATTACHMENTS_BUCKET,
  SIGNED_URL_TTL,
  getSupabaseAdmin,
} from '@/lib/supabaseAdmin';
import { authenticateInbox } from '@/lib/inboxAuth';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { sanitizeEmailHtml, type CidMap } from '@/lib/sanitizeEmailHtml';
import { removeStoragePaths } from '@/lib/storageCleanup';
import type { AttachmentRecord, AttachmentWithUrl, EmailRecord } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

/** Ambil email milik inbox, atau null. */
async function loadOwnedEmail(emailId: string, inboxId: string): Promise<EmailRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('emails')
    .select('*')
    .eq('id', emailId)
    .eq('inbox_id', inboxId)
    .maybeSingle();

  if (error) {
    console.error('loadOwnedEmail error', error.message);
    return null;
  }
  return (data as EmailRecord | null) ?? null;
}

// ---------------------------------------------------------------------------
// GET: detail email
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`read-email:${ip}`, RATE_LIMITS.READ_EMAILS.limit, RATE_LIMITS.READ_EMAILS.windowMs);
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

    const email = await loadOwnedEmail(params.id, inbox.id);
    if (!email) {
      return NextResponse.json({ error: 'Email tidak ditemukan.' }, { status: 404 });
    }

    const supabase = getSupabaseAdmin();

    // Tandai sudah dibaca.
    if (!email.is_read) {
      await supabase.from('emails').update({ is_read: true }).eq('id', email.id);
      email.is_read = true;
    }

    // Ambil lampiran.
    const { data: attachmentsData, error: attError } = await supabase
      .from('attachments')
      .select('*')
      .eq('email_id', email.id);

    if (attError) {
      console.error('GET /api/emails/[id] attachments error', attError.message);
    }

    const attachments: AttachmentWithUrl[] = [];
    const cidMap: CidMap = {};

    for (const att of (attachmentsData ?? []) as AttachmentRecord[]) {
      const { data: signed, error: signError } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .createSignedUrl(att.storage_path, SIGNED_URL_TTL);

      const signedUrl = signError ? null : signed?.signedUrl ?? null;
      if (signError) console.error('createSignedUrl error', signError.message);

      const isInline = Boolean(att.content_id);
      if (isInline && signedUrl && att.content_id) {
        cidMap[att.content_id] = signedUrl;
      }

      attachments.push({ ...att, signedUrl, isInline });
    }

    // Sanitasi HTML + resolve cid.
    const sanitizedHtml = sanitizeEmailHtml(email.body_html ?? '', cidMap);

    return NextResponse.json({
      email: { ...email, sanitizedHtml },
      attachments,
    });
  } catch (err) {
    console.error('GET /api/emails/[id] exception', err);
    return NextResponse.json({ error: 'Kesalahan server.' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH: tandai read/unread
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const inbox = await authenticateInbox(req);
    if (!inbox) {
      return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
    }

    let isRead = true;
    try {
      const body = (await req.json()) as { is_read?: boolean };
      if (typeof body.is_read === 'boolean') isRead = body.is_read;
    } catch {
      // default true
    }

    const email = await loadOwnedEmail(params.id, inbox.id);
    if (!email) {
      return NextResponse.json({ error: 'Email tidak ditemukan.' }, { status: 404 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('emails')
      .update({ is_read: isRead })
      .eq('id', email.id);

    if (error) {
      console.error('PATCH /api/emails/[id] error', error.message);
      return NextResponse.json({ error: 'Gagal memperbarui status.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, is_read: isRead });
  } catch (err) {
    console.error('PATCH /api/emails/[id] exception', err);
    return NextResponse.json({ error: 'Kesalahan server.' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE: hapus email + lampiran
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const inbox = await authenticateInbox(req);
    if (!inbox) {
      return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
    }

    const email = await loadOwnedEmail(params.id, inbox.id);
    if (!email) {
      return NextResponse.json({ error: 'Email tidak ditemukan.' }, { status: 404 });
    }

    const supabase = getSupabaseAdmin();

    // Hapus file lampiran.
    const { data: attachmentsData } = await supabase
      .from('attachments')
      .select('storage_path')
      .eq('email_id', email.id);

    const paths = (attachmentsData ?? []).map((a) => a.storage_path as string);
    await removeStoragePaths(paths);

    // Hapus baris email (cascade attachments).
    const { error } = await supabase.from('emails').delete().eq('id', email.id);
    if (error) {
      console.error('DELETE /api/emails/[id] error', error.message);
      return NextResponse.json({ error: 'Gagal menghapus email.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/emails/[id] exception', err);
    return NextResponse.json({ error: 'Kesalahan server.' }, { status: 500 });
  }
}