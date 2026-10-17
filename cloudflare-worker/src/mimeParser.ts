// ============================================================================
// ANNE TMAIL - MIME Parser (wrapper postal-mime)
// ============================================================================
// Mengubah raw MIME email menjadi struktur ParsedEmail yang siap disimpan,
// termasuk normalisasi pengirim, pemisahan text/html, dan ekstraksi lampiran
// beserta Content-ID (untuk gambar inline cid:).
// ============================================================================

import PostalMime from 'postal-mime';
import type { ParsedAttachment, ParsedEmail } from './types';

/** Ubah isi lampiran postal-mime menjadi ArrayBuffer. */
function toArrayBuffer(content: ArrayBuffer | string | Uint8Array | undefined): ArrayBuffer {
  if (!content) return new ArrayBuffer(0);
  if (content instanceof ArrayBuffer) return content;
  if (content instanceof Uint8Array) {
    return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
  }
  // string -> encode utf-8
  return new TextEncoder().encode(content).buffer as ArrayBuffer;
}

/** Bersihkan Content-ID: hapus < > dan spasi. */
function normalizeContentId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[<>\s]/g, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** Pilih nama file aman: buang path & karakter berbahaya. */
export function safeFileName(name: string, fallback = 'attachment'): string {
  const base = (name || fallback)
    .replace(/[\\/]/g, '_')       // buang separator path
    .replace(/[\r\n\t]/g, '_')
    .replace(/[<>:"|?*\u0000-\u001f]/g, '_')
    .trim();
  const limited = base.slice(0, 180);
  return limited.length > 0 ? limited : fallback;
}

/**
 * Parse raw email MIME.
 * @param raw       ReadableStream dari message.raw (worker) / string / buffer
 * @param recipient alamat tujuan yang sudah dinormalisasi
 */
export async function parseEmail(
  raw: ReadableStream | ArrayBuffer | string,
  recipient: string,
  maxAttachments: number,
  maxAttachmentBytes: number,
): Promise<ParsedEmail> {
  const parsed = await PostalMime.parse(raw as never);

  const fromAddress = (parsed.from?.address ?? '').toLowerCase().trim() || 'unknown@unknown';
  const fromName = parsed.from?.name?.trim() || null;

  const subject = parsed.subject?.trim() || '(Tanpa Subjek)';
  const text = parsed.text ?? '';
  const html = parsed.html ?? '';

  const attachments: ParsedAttachment[] = [];
  for (const att of parsed.attachments ?? []) {
    if (attachments.length >= maxAttachments) break;

    const buffer = toArrayBuffer(att.content as ArrayBuffer | string | Uint8Array | undefined);
    if (buffer.byteLength === 0) continue;
    if (buffer.byteLength > maxAttachmentBytes) continue; // lewati file > 10 MB

    attachments.push({
      filename: safeFileName(att.filename ?? 'attachment'),
      mimeType: att.mimeType || 'application/octet-stream',
      contentId: normalizeContentId(att.contentId),
      content: buffer,
      size: buffer.byteLength,
    });
  }

  return {
    subject,
    fromName,
    fromAddress,
    toAddress: recipient,
    text,
    html,
    attachments,
  };
}