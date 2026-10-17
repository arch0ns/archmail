-- ============================================================================
-- ANNE TMAIL - pg_cron Backup Cleanup (setiap 5 menit)
-- ============================================================================
-- File: 04_pg_cron.sql
-- Cadangan otomatis di sisi database selain Vercel Cron (/api/cron/cleanup).
--
-- CATATAN PENTING:
--   * pg_cron hanya menghapus baris tabel (inboxes -> cascade ke emails &
--     attachments). File fisik di Storage TIDAK bisa dihapus dari SQL.
--   * Penghapusan file Storage dilakukan oleh Vercel Cron dan/atau saat
--     DELETE /api/inbox. pg_cron murni pagar keamanan agar data DB tidak
--     menumpuk bila cron HTTP gagal.
--   * `pg_cron` & `pg_net` hanya tersedia pada Supabase (butuh enable via
--     Dashboard > Database > Extensions bila belum aktif).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Fungsi purge: hapus inbox yang sudah kedaluwarsa (> 30 menit).
-- ON DELETE CASCADE otomatis menghapus emails & attachments terkait.
CREATE OR REPLACE FUNCTION public.purge_expired_inboxes()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    WITH deleted AS (
        DELETE FROM public.inboxes
        WHERE expires_at < now()
        RETURNING id
    )
    SELECT count(*) INTO deleted_count FROM deleted;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Jadwalkan tiap 5 menit (hapus jadwal lama bila sudah ada agar idempotent).
DO $$
BEGIN
    PERFORM cron.unschedule('anne-tmail-purge-expired');
EXCEPTION WHEN OTHERS THEN
    NULL; -- job belum ada
END $$;

SELECT cron.schedule(
    'anne-tmail-purge-expired',
    '*/5 * * * *',
    $$ SELECT public.purge_expired_inboxes(); $$
);

-- Opsional: verifikasi.
--   SELECT * FROM cron.job;
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--   SELECT public.purge_expired_inboxes();  -- jalankan manual