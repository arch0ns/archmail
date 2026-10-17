-- ============================================================================
-- ANNE TMAIL - Database Schema & Storage Setup
-- ============================================================================
-- File   : 01_schema_and_storage.sql
-- Isi    : extension, tabel (domains, inboxes, emails, attachments), index,
--          private storage bucket, RLS enable, realtime publication, trigger
-- Catatan: Semua policy RLS dipisah ke 02_rls_policies.sql (idempotent).
-- ============================================================================

SET statement_timeout = 0;

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 2. TABLES
-- ----------------------------------------------------------------------------

-- Domains: daftar domain temp mail yang aktif (multi-domain)
CREATE TABLE IF NOT EXISTS public.domains (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_name TEXT UNIQUE NOT NULL,
    is_active   BOOLEAN DEFAULT TRUE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Inboxes: setiap user punya inbox unik, masa aktif 30 menit
CREATE TABLE IF NOT EXISTS public.inboxes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_address  TEXT NOT NULL,
    access_token   TEXT UNIQUE NOT NULL,   -- 64-char hex, rahasia, anti-IDOR
    created_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
    expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes')
);

CREATE UNIQUE INDEX IF NOT EXISTS inboxes_email_address_idx ON public.inboxes (email_address);
CREATE INDEX IF NOT EXISTS inboxes_access_token_idx ON public.inboxes (access_token);
CREATE INDEX IF NOT EXISTS inboxes_expires_at_idx ON public.inboxes (expires_at);

-- Emails: isi inbox
CREATE TABLE IF NOT EXISTS public.emails (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inbox_id        UUID NOT NULL REFERENCES public.inboxes (id) ON DELETE CASCADE,
    sender_name     TEXT,
    sender_address  TEXT NOT NULL,
    recipient       TEXT NOT NULL,
    subject         TEXT DEFAULT '(Tanpa Subjek)',
    body_text       TEXT DEFAULT '',
    body_html       TEXT DEFAULT '',
    otp_code        TEXT,
    is_read         BOOLEAN DEFAULT FALSE NOT NULL,
    has_attachments BOOLEAN DEFAULT FALSE NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS emails_inbox_id_idx ON public.emails (inbox_id);
CREATE INDEX IF NOT EXISTS emails_created_at_idx ON public.emails (created_at DESC);

-- Attachments: metadata file lampiran
CREATE TABLE IF NOT EXISTS public.attachments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id      UUID NOT NULL REFERENCES public.emails (id) ON DELETE CASCADE,
    inbox_id      UUID NOT NULL REFERENCES public.inboxes (id) ON DELETE CASCADE,
    file_name     TEXT NOT NULL,
    mime_type     TEXT NOT NULL,
    file_size     INTEGER NOT NULL,
    content_id    TEXT,                       -- CID gambar inline (tanpa <>), bisa NULL
    storage_path  TEXT NOT NULL,              -- {inbox_id}/{email_id}/{file_name}
    created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS attachments_email_id_idx ON public.attachments (email_id);
CREATE INDEX IF NOT EXISTS attachments_inbox_id_idx ON public.attachments (inbox_id);

COMMENT ON COLUMN public.attachments.content_id IS
  'Content-ID gambar inline cid:... tanpa tanda < >, dipakai untuk resolusi cid di body_html';

-- ----------------------------------------------------------------------------
-- 3. STORAGE BUCKET (PRIVATE: public = false)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('email-attachments', 'email-attachments', FALSE, 10485760)  -- 10 MB
ON CONFLICT (id) DO UPDATE
    SET public = FALSE,
        file_size_limit = 10485760;

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (enable; policy di file 02)
-- ----------------------------------------------------------------------------
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 5. REALTIME PUBLICATION
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.emails;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attachments;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inboxes;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- ----------------------------------------------------------------------------
-- 6. TRIGGER: auto-set created_at jika NULL
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._set_created_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.created_at IS NULL THEN
        NEW.created_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_created_at_domains ON public.domains;
CREATE TRIGGER set_created_at_domains
    BEFORE INSERT ON public.domains
    FOR EACH ROW EXECUTE FUNCTION public._set_created_at();

DROP TRIGGER IF EXISTS set_created_at_inboxes ON public.inboxes;
CREATE TRIGGER set_created_at_inboxes
    BEFORE INSERT ON public.inboxes
    FOR EACH ROW EXECUTE FUNCTION public._set_created_at();

DROP TRIGGER IF EXISTS set_created_at_emails ON public.emails;
CREATE TRIGGER set_created_at_emails
    BEFORE INSERT ON public.emails
    FOR EACH ROW EXECUTE FUNCTION public._set_created_at();

DROP TRIGGER IF EXISTS set_created_at_attachments ON public.attachments;
CREATE TRIGGER set_created_at_attachments
    BEFORE INSERT ON public.attachments
    FOR EACH ROW EXECUTE FUNCTION public._set_created_at();