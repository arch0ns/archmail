'use client';

// ============================================================================
// ANNE TMAIL - Navbar
// ============================================================================
// Header aplikasi: logo, status Realtime (radar), jumlah unread, toggle suara.
// ============================================================================

import { motion } from 'framer-motion';

interface NavbarProps {
  realtimeConnected: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  unreadCount: number;
}

export function Navbar({ realtimeConnected, soundEnabled, onToggleSound, unreadCount }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-surface-border/60 bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-lg font-bold text-white shadow-lg">
            ✉
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-emerald-400" />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-semibold tracking-tight text-white">ANNE TMAIL</h1>
            <p className="text-[11px] text-slate-400">Secure Real-Time Temp Mail</p>
          </div>
        </div>

        {/* Aksi kanan */}
        <div className="flex items-center gap-2">
          {/* Status Realtime */}
          <div
            className="hidden items-center gap-2 rounded-full border border-surface-border/70 bg-surface-soft/60 px-3 py-1.5 text-xs text-slate-300 sm:flex"
            title={realtimeConnected ? 'Realtime tersambung' : 'Mode fallback polling'}
          >
            <span className="relative flex h-2.5 w-2.5">
              {realtimeConnected && (
                <span className="absolute inline-flex h-full w-full animate-radar-ping rounded-full bg-emerald-400/70" />
              )}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  realtimeConnected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            </span>
            <span>{realtimeConnected ? 'Realtime' : 'Polling'}</span>
          </div>

          {/* Unread badge */}
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex h-7 min-w-7 items-center justify-center rounded-full bg-brand px-2 text-xs font-semibold text-white"
              title={`${unreadCount} email belum dibaca`}
            >
              {unreadCount}
            </motion.span>
          )}

          {/* Toggle suara */}
          <button
            type="button"
            onClick={onToggleSound}
            className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition ${
              soundEnabled
                ? 'border-brand/50 bg-brand/15 text-brand-soft'
                : 'border-surface-border/70 bg-surface-soft/60 text-slate-400'
            }`}
            aria-pressed={soundEnabled}
            title={soundEnabled ? 'Matikan suara notifikasi' : 'Nyalakan suara notifikasi'}
          >
            <span aria-hidden>{soundEnabled ? '🔔' : '🔕'}</span>
            <span className="hidden sm:inline">{soundEnabled ? 'Suara Aktif' : 'Suara Mati'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}