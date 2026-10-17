'use client';

// ============================================================================
// ANNE TMAIL - Inbox Sidebar
// ============================================================================
// Daftar email real-time: radar saat kosong, animasi masuk, unread dot,
// badge OTP + tombol salin, ikon lampiran, dan waktu relatif (update 15 detik).
// ============================================================================

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import { copyToClipboard, formatRelativeTime, getInitials } from '@/lib/utils';
import type { EmailListItem } from '@/types';

type FilterKind = 'all' | 'unread';

interface InboxSidebarProps {
  emails: EmailListItem[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (email: EmailListItem) => void;
}

export function InboxSidebar({ emails, loading, selectedId, onSelect }: InboxSidebarProps) {
  const { show } = useToast();
  const [filter, setFilter] = useState<FilterKind>('all');
  const [tick, setTick] = useState(() => Date.now());

  // Update waktu relatif setiap 15 detik.
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const visible = useMemo(
    () => (filter === 'unread' ? emails.filter((e) => !e.is_read) : emails),
    [emails, filter],
  );

  const unreadCount = emails.filter((e) => !e.is_read).length;

  const handleCopyOtp = async (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    const ok = await copyToClipboard(code);
    show(ok ? `Kode OTP ${code} disalin!` : 'Gagal menyalin OTP.', ok ? 'success' : 'error');
  };

  return (
    <section className="flex h-full flex-col rounded-2xl border border-surface-border/60 bg-surface-card/70 shadow-xl backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-surface-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Inbox</h2>
          <span className="rounded-full bg-surface-soft/70 px-2 py-0.5 text-[11px] text-slate-300">
            {emails.length}
          </span>
        </div>
        <div className="flex gap-1 rounded-lg border border-surface-border/60 bg-surface-soft/50 p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-md px-2 py-1 transition ${
              filter === 'all' ? 'bg-brand text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={`rounded-md px-2 py-1 transition ${
              filter === 'unread' ? 'bg-brand text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
          </button>
        </div>
      </div>

      {/* Radar aktif (menunggu email) */}
      <div className="flex items-center gap-2 border-b border-surface-border/60 px-4 py-2.5 text-xs">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-radar-ping rounded-full bg-emerald-400/70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <span className="text-slate-300">
          {emails.length === 0 ? 'Radar Aktif — Menunggu email masuk…' : 'Memantau email baru…'}
        </span>
      </div>

      {/* Daftar */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && emails.length === 0 && (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-soft/50" />
            ))}
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <div className="text-3xl">📭</div>
            <p className="text-sm text-slate-300">
              {filter === 'unread' ? 'Tidak ada email belum dibaca.' : 'Belum ada email masuk.'}
            </p>
            <p className="text-xs text-slate-500">
              Email akan muncul otomatis dalam hitungan detik.
            </p>
          </div>
        )}

        <ul className="divide-y divide-surface-border/40">
          <AnimatePresence initial={false}>
            {visible.map((email) => {
              const active = email.id === selectedId;
              return (
                <motion.li
                  key={email.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(email)}
                    className={`w-full px-4 py-3 text-left transition ${
                      active ? 'bg-brand/10' : 'hover:bg-surface-soft/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar + unread dot */}
                      <div className="relative shrink-0">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${
                            email.is_read
                              ? 'bg-surface-soft text-slate-400'
                              : 'bg-brand/25 text-brand-soft'
                          }`}
                        >
                          {getInitials(email.sender_name, email.sender_address)}
                        </div>
                        {!email.is_read && (
                          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-surface-card" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`truncate text-sm ${
                              email.is_read ? 'text-slate-400' : 'font-semibold text-white'
                            }`}
                          >
                            {email.sender_name || email.sender_address}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-500">
                            {formatRelativeTime(email.created_at, tick)}
                          </span>
                        </div>
                        <p
                          className={`mt-0.5 truncate text-sm ${
                            email.is_read ? 'text-slate-500' : 'text-slate-200'
                          }`}
                        >
                          {email.subject || '(Tanpa Subjek)'}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          {email.has_attachments && (
                            <span className="text-xs text-slate-400" title="Ada lampiran">
                              📎
                            </span>
                          )}
                          {email.otp_code && (
                            <button
                              type="button"
                              onClick={(e) => handleCopyOtp(e, email.otp_code as string)}
                              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-200 transition hover:bg-emerald-500/20"
                              title="Salin kode OTP"
                            >
                              OTP {email.otp_code} 📋
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>
    </section>
  );
}