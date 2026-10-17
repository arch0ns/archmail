-- ============================================================================
-- ANNE TMAIL - Seed Data (Multi-Domain)
-- ============================================================================
-- File: 03_seed_domains.sql
-- Ganti / tambahkan domain sesuai domain kamu yang sudah diarahkan ke
-- Cloudflare Email Routing. Idempotent via ON CONFLICT.
-- ============================================================================

INSERT INTO public.domains (domain_name, is_active) VALUES
    ('mail.example.com',     TRUE),
    ('temp.example.com',     TRUE),
    ('inbox.example.com',    TRUE)
ON CONFLICT (domain_name) DO UPDATE
    SET is_active = EXCLUDED.is_active;

-- Verifikasi:
--   SELECT id, domain_name, is_active FROM public.domains ORDER BY domain_name;