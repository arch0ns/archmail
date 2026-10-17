// ============================================================================
// ANNE TMAIL - Storage Cleanup Helpers
// ============================================================================
// Menghapus seluruh file di bucket privat `email-attachments` yang berada di
// bawah prefix tertentu (mis. `{inboxId}/`). Supabase Storage list hanya
// mengembalikan satu level, jadi kita telusuri secara rekursif.
// ============================================================================

import { ATTACHMENTS_BUCKET, getSupabaseAdmin } from '@/lib/supabaseAdmin';

/** Kumpulkan semua path file (bukan folder) di bawah prefix secara rekursif. */
async function collectStoragePaths(prefix: string, depth = 0): Promise<string[]> {
  if (depth > 4) return []; // batas kedalaman aman

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

  if (error) {
    console.error('collectStoragePaths list error', prefix, error.message);
    return [];
  }

  const results: string[] = [];
  for (const entry of data ?? []) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    // Supabase menandai folder dengan metadata == null / id == null.
    const isFolder = entry.id === null || entry.metadata === null;
    if (isFolder) {
      const nested = await collectStoragePaths(fullPath, depth + 1);
      results.push(...nested);
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

/** Hapus seluruh file di bawah prefix `{inboxId}/`. */
export async function removeInboxStorage(inboxId: string): Promise<void> {
  const paths = await collectStoragePaths(inboxId);
  if (paths.length === 0) return;

  const supabase = getSupabaseAdmin();
  // remove() dibatasi jumlah per panggilan; pecah menjadi batch 100.
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove(batch);
    if (error) console.error('removeInboxStorage remove error', error.message);
  }
}

/** Hapus daftar path spesifik dari bucket. */
export async function removeStoragePaths(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = getSupabaseAdmin();
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove(batch);
    if (error) console.error('removeStoragePaths error', error.message);
  }
}