// ============================================================================
// GET /api/domains  - daftar domain aktif
// ============================================================================

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('domains')
      .select('id, domain_name, is_active')
      .eq('is_active', true)
      .order('domain_name', { ascending: true });

    if (error) {
      console.error('GET /api/domains error', error.message);
      return NextResponse.json({ error: 'Gagal memuat daftar domain.' }, { status: 500 });
    }

    return NextResponse.json(
      {
        domains: (data ?? []).map((d) => ({ id: d.id, domain_name: d.domain_name })),
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
      },
    );
  } catch (err) {
    console.error('GET /api/domains exception', err);
    return NextResponse.json({ error: 'Kesalahan server.' }, { status: 500 });
  }
}