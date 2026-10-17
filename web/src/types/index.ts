// ============================================================================
// ANNE TMAIL - Shared Types (Web)
// ============================================================================

export interface Domain {
  id: string;
  domain_name: string;
  is_active: boolean;
  created_at: string;
}

export interface Inbox {
  id: string;
  email_address: string;
  access_token: string;
  created_at: string;
  expires_at: string;
}

/** Inbox yang sudah dibersihkan tokennya (aman dikirim ke client). */
export interface PublicInbox {
  inboxId: string;
  emailAddress: string;
  expiresAt: string;
}

export interface EmailRecord {
  id: string;
  inbox_id: string;
  sender_name: string | null;
  sender_address: string;
  recipient: string;
  subject: string | null;
  body_text: string;
  body_html: string;
  otp_code: string | null;
  is_read: boolean;
  has_attachments: boolean;
  created_at: string;
}

/** Email untuk daftar inbox (tanpa body besar). */
export type EmailListItem = Omit<EmailRecord, 'body_text' | 'body_html'>;

export interface AttachmentRecord {
  id: string;
  email_id: string;
  inbox_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  content_id: string | null;
  storage_path: string;
  created_at: string;
}

/** Lampiran + signed URL (10 menit). */
export interface AttachmentWithUrl extends AttachmentRecord {
  signedUrl: string | null;
  isInline: boolean;
}

// ---------------------------------------------------------------------------
// API payloads
// ---------------------------------------------------------------------------

export interface CreateInboxRequest {
  username?: string;
  domain?: string;
  randomDomain?: boolean;
}

export interface CreateInboxResponse {
  inboxId: string;
  emailAddress: string;
  accessToken: string;
  expiresAt: string;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: string;
}

export interface EmailsListResponse {
  emails: EmailListItem[];
  expiresAt: string;
}

export interface EmailDetailResponse {
  email: EmailRecord & {
    /** HTML yang sudah disanitasi + cid: diganti signed URL. */
    sanitizedHtml: string;
  };
  attachments: AttachmentWithUrl[];
}

// ---------------------------------------------------------------------------
// UI helper types
// ---------------------------------------------------------------------------

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

export interface SessionPersisted {
  inboxId: string;
  emailAddress: string;
  accessToken: string;
  expiresAt: string;
}