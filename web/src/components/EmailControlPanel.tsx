'use client';

// ============================================================================
// ANNE TMAIL - Email Control Panel
// ============================================================================
// Menampilkan alamat email aktif, tombol salin, hapus & buat baru, serta form
// custom (username + validasi realtime + dropdown domain + Random Domain).
// ============================================================================

import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { ExpiryCountdown } from '@/components/ExpiryCountdown';
import { useToast } from '@/components/Toast';
import { copyToClipboard } from '@/lib/utils';
import { validateUsername } from '@/lib/usernameValidator';
import type { CreateInboxRequest, Domain, SessionPersisted } from '@/types';

interface EmailControlPanelProps {
  inbox: SessionPersisted | null;
  domains: Domain[];
  creating: boolean;
  remainingMs: number;
  error: string | null;
  onCreate: (payload?: CreateInboxRequest) => Promise<boolean>;
  onReset: (payload?: CreateInboxRequest) => Promise<boolean>;
  onDelete: () => Promise<void>;
}

export function EmailControlPanel({
  inbox,
  domains,
  creating,
  remainingMs,
  error,
  onCreate,
  onReset,
  onDelete,
}: EmailControlPanelProps) {
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [domain, setDomain] = useState('');

  const usernameCheck = useMemo(() => {
    if (username.trim().length === 0) return null;
    return validateUsername(username);
  }, [username]);

  const usernameInvalid = usernameCheck !== null && !usernameCheck.valid;

  const handleCopy = async () => {
    if (!inbox) return;
    const ok = await copyToClipboard(inbox.emailAddress);
    show(ok ? 'Alamat email berhasil disalin!' : 'Gagal menyalin alamat email.', ok ? 'success' : 'error');
  };

  const handleRandom = async () => {
    const ok = await onCreate({ randomDomain: true });
    if (ok) {
      show('Inbox acak baru berhasil dibuat!', 'success');
      setOpen(false);
    }
  };

  const handleApplyCustom = async () => {
    if (usernameInvalid) {
      show('Username tidak valid.', 'error');
      return;
    }
    const payload: CreateInboxRequest = {
      username: username.trim() || undefined,
      randomDomain: domain === '',
      domain: domain || undefined,
    };
    const ok = await onReset(payload);
    if (ok) {
      show('Custom email berhasil diterapkan!', 'success');
      setOpen(false);
    }
  };

  const handleDeleteAndNew = async () => {
    await onDelete();
    const ok = await onCreate({ randomDomain: true });
    if (ok) show('Inbox lama dihapus & inbox baru dibuat.', 'success');
  };

  return (
    <section className="rounded-2xl border border-surface-border/60 bg-surface-card/70 p-4 shadow-xl backdrop-blur sm:p-5">
      {inbox ? (
        <div className="space-y-4">
          {/* Alamat email */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs text-slate-400">Alamat email aktif</p>
              <div className="truncate rounded-xl border border-surface-border/70 bg-surface-soft/70 px-3 py-2.5 font-mono text-sm text-white sm:text-base">
                {inbox.emailAddress}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark sm:flex-none"
              >
                📋 Salin Email
              </button>
              <button
                type="button"
                onClick={handleDeleteAndNew}
                disabled={creating}
                className="flex-1 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50 sm:flex-none"
              >
                ♻️ Hapus &amp; Buat Baru
              </button>
            </div>
          </div>

          {/* Countdown */}
          <ExpiryCountdown remainingMs={remainingMs} />
        </div>
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-sm text-slate-300">
            Belum ada inbox aktif. Buat alamat email sementara sekarang.
          </p>
          <button
            type="button"
            onClick={handleRandom}
            disabled={creating}
            className="w-full rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {creating ? 'Membuat…' : '✨ Buat Email Acak (1 Klik)'}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}

      {/* Toggle form custom */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-4 flex w-full items-center justify-between rounded-xl border border-surface-border/60 bg-surface-soft/40 px-3 py-2.5 text-xs font-medium text-slate-300 transition hover:bg-surface-soft/70"
        aria-expanded={open}
      >
        <span>⚙️ Custom Username &amp; Domain</span>
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-1 pt-4">
              {/* Username */}
              <div>
                <label htmlFor="custom-username" className="mb-1 block text-xs text-slate-400">
                  Username
                </label>
                <input
                  id="custom-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="mis. john.doe (kosongkan untuk acak)"
                  className={`w-full rounded-xl border bg-surface-soft/70 px-3 py-2.5 font-mono text-sm text-white outline-none transition focus:ring-2 ${
                    usernameInvalid
                      ? 'border-rose-500/60 focus:ring-rose-500/30'
                      : 'border-surface-border/70 focus:ring-brand/40'
                  }`}
                  autoComplete="off"
                  spellCheck={false}
                />
                {usernameInvalid && (
                  <p className="mt-1.5 text-xs text-rose-300">{usernameCheck?.reason}</p>
                )}
                {usernameCheck?.valid && (
                  <p className="mt-1.5 text-xs text-emerald-300">✓ Username tersedia.</p>
                )}
              </div>

              {/* Domain */}
              <div>
                <label htmlFor="custom-domain" className="mb-1 block text-xs text-slate-400">
                  Domain
                </label>
                <select
                  id="custom-domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full rounded-xl border border-surface-border/70 bg-surface-soft/70 px-3 py-2.5 text-sm text-white outline-none transition focus:ring-2 focus:ring-brand/40"
                >
                  <option value="">🎲 Random Domain</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.domain_name}>
                      {d.domain_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Aksi */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  disabled={creating || usernameInvalid}
                  className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
                >
                  Terapkan Custom Email
                </button>
                <button
                  type="button"
                  onClick={handleRandom}
                  disabled={creating}
                  className="flex-1 rounded-xl border border-surface-border/70 bg-surface-soft/60 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-surface-soft disabled:opacity-50"
                >
                  Buat Email Acak
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}