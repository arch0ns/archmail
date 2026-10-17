-- ============================================================================
-- ANNE TMAIL - Row Level Security Policies
-- ============================================================================
-- File: 02_rls_policies.sql
-- Idempotent: setiap policy di-DROP dulu sebelum CREATE.
--
-- Prinsip keamanan:
--   * API routes Next.js & Cloudflare Worker memakai SERVICE ROLE key.
--     Service role MEM-BYPASS RLS, jadi tidak perlu policy permissive untuk
--     operasi tulis (INSERT/DELETE/UPDATE).
--   * Hanya perlu policy SELECT untuk `anon` role agar Supabase Realtime
--     (WebSocket) bisa membaca baris emails/attachments yang diizinkan.
--   * `inboxes` TIDAK diberi policy SELECT publik, agar access_token tidak
--     pernah bisa dibaca dari client.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- DOMAINS: boleh dibaca publik (hanya nama domain, non-sensitif)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "domains_public_read" ON public.domains;
CREATE POLICY "domains_public_read" ON public.domains
    FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

-- ----------------------------------------------------------------------------
-- INBOXES: tidak ada policy untuk anon/authenticated (default deny).
-- Service role tetap bisa baca/tulis karena bypass RLS.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- EMAILS: SELECT hanya jika header request x-inbox-token cocok dengan
-- access_token inbox pemilik DAN inbox belum kedaluwarsa (anti-IDOR).
-- Dipakai oleh Supabase Realtime saat client mengirim header x-inbox-token.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "emails_read_with_valid_token" ON public.emails;
CREATE POLICY "emails_read_with_valid_token" ON public.emails
    FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.inboxes i
            WHERE i.id = emails.inbox_id
              AND i.access_token =
                  (current_setting('request.headers', true)::json ->> 'x-inbox-token')
              AND i.expires_at > now()
        )
    );

-- ----------------------------------------------------------------------------
-- ATTACHMENTS: SELECT hanya jika token valid untuk email & inbox terkait.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "attachments_read_with_valid_token" ON public.attachments;
CREATE POLICY "attachments_read_with_valid_token" ON public.attachments
    FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.emails e
            JOIN public.inboxes i ON i.id = e.inbox_id
            WHERE e.id = attachments.email_id
              AND i.access_token =
                  (current_setting('request.headers', true)::json ->> 'x-inbox-token')
              AND i.expires_at > now()
        )
    );

-- ----------------------------------------------------------------------------
-- STORAGE: bucket `email-attachments` bersifat privat.
-- Akses file hanya lewat Signed URL yang dibuat oleh service role.
-- Tidak ada policy anon => default deny untuk anon/authenticated.
-- (Service role bypass RLS storage.)
-- ----------------------------------------------------------------------------
-- Sengaja tidak membuat policy storage.objects untuk anon.

-- ----------------------------------------------------------------------------
-- VERIFIKASI (opsional, jalankan manual):
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
--   SELECT tablename, policyname, roles, cmd FROM pg_policies
--     WHERE schemaname IN ('public','storage') ORDER BY tablename;
-- ----------------------------------------------------------------------------