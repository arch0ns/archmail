// ============================================================================
// ANNE TMAIL - Shared Types (Cloudflare Worker)
// ============================================================================

/** Bindings & variabel environment worker. */
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MAX_ATTACHMENTS?: string;
  MAX_ATTACHMENT_BYTES?: string;
}

/** Baris inbox aktif dari tabel public.inboxes. */
export interface InboxRow {
  id: string;
  email_address: string;
  expires_at: string;
}

/** Lampiran hasil parsing MIME. */
export interface ParsedAttachment {
  filename: string;
  mimeType: string;
  /** Content-ID tanpa tanda < >, dipakai untuk gambar inline cid:. */
  contentId: string | null;
  content: ArrayBuffer;
  size: number;
}

/** Hasil parsing email lengkap. */
export interface ParsedEmail {
  subject: string;
  fromName: string | null;
  fromAddress: string;
  toAddress: string;
  text: string;
  html: string;
  attachments: ParsedAttachment[];
}

/** Payload insert ke tabel public.emails. */
export interface EmailInsert {
  inbox_id: string;
  sender_name: string | null;
  sender_address: string;
  recipient: string;
  subject: string;
  body_text: string;
  body_html: string;
  otp_code: string | null;
  has_attachments: boolean;
}

/** Baris hasil insert email (return=representation). */
export interface EmailRow {
  id: string;
}

/** Metadata lampiran yang disimpan ke tabel public.attachments. */
export interface AttachmentMetaInsert {
  email_id: string;
  inbox_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  content_id: string | null;
  storage_path: string;
}