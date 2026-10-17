// ============================================================================
// GET /api/cron/cleanup
// Vercel Cron: "*/5 * * * *" (lihat vercel.json)
// Otorisasi: header Authorization: Bearer <CRON_SECRET>
// Tugas: hapus inbox kedaluwarsa + seluruh file lampiran di Storage.
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { removeInboxStorage } from '@/lib/storageCleanup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // wajib dikonfigurasi

  const header = req.headers.get('authorization');
  if (header && header === `Bearer ${secret}`) return true;

  // Dukungan opsional via query (?secret=) untuk uji manual.
  const url = new URL(req.url);
  return url.searchParams.get('secret') === secret;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    // Ambil inbox yang sudah kedaluwarsa.
    const { data: expired, error } = await supabase
      .from('inboxes')
      .select('id')
      .lt('expires_at', nowIso);

    if (error) {
      console.error('cron cleanup query error', error.message);
      return NextResponse.json({ error: 'Gagal memuat inbox kedaluwarsa.' }, { status: 500 });
    }

    const inboxIds = (expired ?? []).map((row) => row.id as string);
    if (inboxIds.length === 0) {
      return NextResponse.json({ success: true, purgedInboxes: 0, purgedFiles: 'unknown' });
    }

    // Hapus file storage per inbox lebih dulu.
    for (const id of inboxIds) {
      await removeInboxStorage(id);
    }

    // Hapus baris inbox (cascade emails + attachments).
    const { error: deleteError } = await supabase.from('inboxes').delete().in('id', inboxIds);
    if (deleteError) {
      console.error('cron cleanup delete error', deleteError.message);
      return NextResponse.json({ error: 'Gagal menghapus inbox.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, purgedInboxes: inboxIds.length });
  } catch (err) {
    console.error('cron cleanup exception', err);
    return NextResponse.json({ error: 'Kesalahan server.' }, { status: 500 });
  }
}