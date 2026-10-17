// ============================================================================
// ANNE TMAIL - Cloudflare Email Worker (Catch-All Handler)
// ============================================================================
// Alur:
//   1. Normalisasi alamat tujuan.
//   2. Cek inbox aktif di Supabase (email_address + belum expired).
//      Jika tidak ada -> abaikan (tolak) supaya DB & Storage tidak di-spam.
//   3. Parse MIME (postal-mime) + ekstrak OTP.
//   4. Simpan email ke public.emails (return=representation -> dapat id).
//   5. Upload lampiran ke Storage bucket `email-attachments` (maks 5 file,
//      masing-masing < 10 MB) + simpan metadata (termasuk content_id/CID).
// ============================================================================

import { parseEmail, safeFileName } from './mimeParser';
import { extractOtp } from './otpExtractor';
import type {
  AttachmentMetaInsert,
  EmailInsert,
  EmailRow,
  Env,
  InboxRow,
} from './types';

const DEFAULT_MAX_ATTACHMENTS = 5;
const DEFAULT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
const BUCKET = 'email-attachments';

/** Bangun header standar Supabase REST. */
function supabaseHeaders(env: Env, extra: Record<string, string> = {}): HeadersInit {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/** Hapus trailing slash pada URL Supabase. */
function baseUrl(env: Env): string {
  return env.SUPABASE_URL.replace(/\/+$/, '');
}

/** Cari inbox aktif berdasarkan alamat tujuan (belum expired). */
async function findActiveInbox(env: Env, recipient: string): Promise<InboxRow | null> {
  const url = new URL(`${baseUrl(env)}/rest/v1/inboxes`);
  url.searchParams.set('email_address', `eq.${recipient}`);
  url.searchParams.set('expires_at', `gt.${new Date().toISOString()}`);
  url.searchParams.set('select', 'id,email_address,expires_at');
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), { headers: supabaseHeaders(env) });
  if (!res.ok) {
    console.error('findActiveInbox failed', res.status, await res.text());
    return null;
  }
  const rows = (await res.json()) as InboxRow[];
  return rows.length > 0 ? rows[0] : null;
}

/** Simpan email ke public.emails, kembalikan id-nya. */
async function insertEmail(env: Env, payload: EmailInsert): Promise<string | null> {
  const res = await fetch(`${baseUrl(env)}/rest/v1/emails`, {
    method: 'POST',
    headers: supabaseHeaders(env, { Prefer: 'return=representation' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error('insertEmail failed', res.status, await res.text());
    return null;
  }
  const rows = (await res.json()) as EmailRow[];
  return rows.length > 0 ? rows[0].id : null;
}

/** Upload satu lampiran ke Supabase Storage (private bucket). */
async function uploadAttachment(
  env: Env,
  storagePath: string,
  mimeType: string,
  content: ArrayBuffer,
): Promise<boolean> {
  const segments = storagePath.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(`${baseUrl(env)}/storage/v1/object/${BUCKET}/${segments}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': mimeType || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: content,
  });
  if (!res.ok) {
    console.error('uploadAttachment failed', res.status, await res.text());
    return false;
  }
  return true;
}

/** Simpan metadata lampiran ke public.attachments. */
async function insertAttachmentMeta(env: Env, rows: AttachmentMetaInsert[]): Promise<void> {
  if (rows.length === 0) return;
  const res = await fetch(`${baseUrl(env)}/rest/v1/attachments`, {
    method: 'POST',
    headers: supabaseHeaders(env, { Prefer: 'return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    console.error('insertAttachmentMeta failed', res.status, await res.text());
  }
}

/** Handler utama email() dari Cloudflare Email Routing. */
async function handleEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
  const recipient = message.to.toLowerCase().trim();

  // 1. Cek inbox aktif.
  const inbox = await findActiveInbox(env, recipient);
  if (!inbox) {
    console.log(`No active inbox for ${recipient} -> email ignored`);
    return;
  }

  const maxAttachments = Number(env.MAX_ATTACHMENTS ?? DEFAULT_MAX_ATTACHMENTS);
  const maxAttachmentBytes = Number(env.MAX_ATTACHMENT_BYTES ?? DEFAULT_MAX_ATTACHMENT_BYTES);

  // 2. Parse MIME + OTP.
  const parsed = await parseEmail(message.raw, recipient, maxAttachments, maxAttachmentBytes);
  const otp = extractOtp(parsed.text, parsed.html);

  // 3. Simpan email.
  const emailPayload: EmailInsert = {
    inbox_id: inbox.id,
    sender_name: parsed.fromName,
    sender_address: parsed.fromAddress,
    recipient,
    subject: parsed.subject,
    body_text: parsed.text,
    body_html: parsed.html,
    otp_code: otp,
    has_attachments: parsed.attachments.length > 0,
  };

  const emailId = await insertEmail(env, emailPayload);
  if (!emailId) {
    console.error('Email not saved, skipping attachments');
    return;
  }

  if (parsed.attachments.length === 0) {
    console.log(`Saved email ${emailId} for ${recipient} (no attachments)`);
    return;
  }

  // 4. Upload tiap lampiran + kumpulkan metadata.
  const metaRows: AttachmentMetaInsert[] = [];
  for (const att of parsed.attachments) {
    const fileName = safeFileName(att.filename);
    const storagePath = `${inbox.id}/${emailId}/${fileName}`;

    const ok = await uploadAttachment(env, storagePath, att.mimeType, att.content);
    if (!ok) continue;

    metaRows.push({
      email_id: emailId,
      inbox_id: inbox.id,
      file_name: fileName,
      mime_type: att.mimeType,
      file_size: att.size,
      content_id: att.contentId,
      storage_path: storagePath,
    });
  }

  await insertAttachmentMeta(env, metaRows);
  console.log(
    `Saved email ${emailId} for ${recipient} with ${metaRows.length}/${parsed.attachments.length} attachments`,
  );
}

export default {
  async email(
    message: ForwardableEmailMessage,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      handleEmail(message, env).catch((err) => {
        console.error('Unhandled error in email handler:', err);
      }),
    );
  },
} satisfies ExportedHandler<Env>;