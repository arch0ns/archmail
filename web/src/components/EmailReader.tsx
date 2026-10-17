'use client';

// ============================================================================
// ANNE TMAIL - Email Reader
// ============================================================================
// Header pesan, daftar lampiran (Signed URL 10 menit), isi email di dalam
// <iframe sandbox> (tanpa allow-scripts / allow-same-origin), tab HTML/Plain.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/Toast';
import { copyToClipboard, formatFileSize, formatFullDateTime } from '@/lib/utils';
import type { EmailDetailResponse } from '@/types';

interface EmailReaderProps {
  detail: EmailDetailResponse | null;
  loading: boolean;
  onDelete: (id: string) => void;
}

type TabKind = 'html' | 'text';

const IFRAME_SANDBOX = 'allow-popups allow-popups-to-escape-sandbox';

export function EmailReader({ detail, loading, onDelete }: EmailReaderProps) {
  const { show } = useToast();
  const [tab, setTab] = useState<TabKind>('html');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Reset tab saat email berubah.
  useEffect(() => {
    setTab('html');
  }, [detail?.email.id]);

  const handleCopyOtp = async () => {
    const code = detail?.email.otp_code;
    if (!code) return;
    const ok = await copyToClipboard(code);
    show(ok ? `Kode OTP ${code} disalin!` : 'Gagal menyalin OTP.', ok ? 'success' : 'error');
  };

  // Auto-resize best-effort. Pada sandbox tanpa allow-same-origin akses
  // contentDocument diblokir browser, sehingga ini hanya berfungsi bila
  // kebijakan mengizinkan; kita bungkus dengan try/catch agar aman.
  const handleIframeLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      const height = doc?.body?.scrollHeight;
      if (height && iframeRef.current) {
        iframeRef.current.style.height = `${Math.min(Math.max(height + 24, 320), 2400)}px`;
      }
    } catch {
      // Diblokir sandbox (opsional) — biarkan tinggi default.
    }
  };

  if (loading && !detail) {
    return (
      <section className="flex h-full items-center justify-center rounded-2xl border border-surface-border/60 bg-surface-card/70 p-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-surface-border/60 bg-surface-card/70 p-10 text-center">
        <div className="text-4xl">📨</div>
        <p className="text-sm text-slate-300">Pilih email untuk membacanya di sini.</p>
        <p className="text-xs text-slate-500">Konten dirender aman di dalam sandbox.</p>
      </section>
    );
  }

  const { email, attachments } = detail;
  const inlineAttachments = attachments.filter((a) => a.isInline);

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-surface-border/60 bg-surface-card/70 shadow-xl">
      {/* Header */}
      <div className="border-b border-surface-border/60 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 flex-1 break-words text-lg font-semibold text-white">
            {email.subject || '(Tanpa Subjek)'}
          </h2>
          <button
            type="button"
            onClick={() => onDelete(email.id)}
            className="shrink-0 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20"
          >
            🗑 Hapus
          </button>
        </div>

        <div className="mt-3 space-y-1 text-xs text-slate-400">
          <p>
            <span className="text-slate-500">Dari:</span>{' '}
            <span className="text-slate-200">
              {email.sender_name ? `${email.sender_name} ` : ''}
              &lt;{email.sender_address}&gt;
            </span>
          </p>
          <p>
            <span className="text-slate-500">Kepada:</span>{' '}
            <span className="text-slate-200">{email.recipient}</span>
          </p>
          <p>
            <span className="text-slate-500">Waktu:</span>{' '}
            <span className="text-slate-200">{formatFullDateTime(email.created_at)}</span>
          </p>
        </div>

        {email.otp_code && (
          <button
            type="button"
            onClick={handleCopyOtp}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-200 transition hover:bg-emerald-500/20"
          >
            OTP: {email.otp_code} 📋 Salin
          </button>
        )}
      </div>

      {/* Tab switch */}
      <div className="flex items-center gap-1 border-b border-surface-border/60 px-4 py-2 text-xs sm:px-5">
        <button
          type="button"
          onClick={() => setTab('html')}
          className={`rounded-md px-3 py-1.5 transition ${
            tab === 'html' ? 'bg-brand text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Tampilan HTML
        </button>
        <button
          type="button"
          onClick={() => setTab('text')}
          className={`rounded-md px-3 py-1.5 transition ${
            tab === 'text' ? 'bg-brand text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Plain Text
        </button>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Lampiran (non-inline) */}
        {attachments.length > 0 && (
          <div className="border-b border-surface-border/60 px-4 py-3 sm:px-5">
            <p className="mb-2 text-xs font-medium text-slate-400">
              Lampiran ({attachments.length})
              {inlineAttachments.length > 0 && (
                <span className="ml-2 text-slate-500">
                  • {inlineAttachments.length} gambar inline
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.signedUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  download={att.file_name}
                  aria-disabled={!att.signedUrl}
                  className={`flex max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                    att.signedUrl
                      ? 'border-surface-border/70 bg-surface-soft/60 text-slate-200 hover:bg-surface-soft'
                      : 'pointer-events-none border-surface-border/40 bg-surface-soft/30 text-slate-500'
                  }`}
                  title={att.isInline ? 'Gambar inline' : 'Lampiran'}
                >
                  <span aria-hidden>{att.isInline ? '🖼' : '📎'}</span>
                  <span className="max-w-[180px] truncate">{att.file_name}</span>
                  <span className="text-slate-500">{formatFileSize(att.file_size)}</span>
                  {att.signedUrl && <span className="text-brand-soft">↓</span>}
                </a>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Tautan unduh berupa Signed URL, berlaku 10 menit.
            </p>
          </div>
        )}

        {tab === 'html' ? (
          email.sanitizedHtml ? (
            <motion.div
              key="html"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-2 sm:p-3"
            >
              <iframe
                ref={iframeRef}
                title={`Isi email: ${email.subject || '(Tanpa Subjek)'}`}
                sandbox={IFRAME_SANDBOX}
                srcDoc={email.sanitizedHtml}
                onLoad={handleIframeLoad}
                className="min-h-[360px] w-full rounded-xl border border-surface-border/60 bg-white"
              />
            </motion.div>
          ) : (
            <div className="px-4 py-6 text-sm text-slate-400 sm:px-5">
              Email ini tidak memiliki versi HTML. Beralih ke tab <strong>Plain Text</strong>.
            </div>
          )
        ) : (
          <motion.pre
            key="text"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="whitespace-pre-wrap break-words px-4 py-4 font-mono text-sm text-slate-200 sm:px-5"
          >
            {email.body_text?.trim() || '(Tidak ada isi teks)'}
          </motion.pre>
        )}
      </div>
    </section>
  );
}