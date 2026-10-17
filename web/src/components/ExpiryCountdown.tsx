'use client';

// ============================================================================
// ANNE TMAIL - Expiry Countdown (30 menit)
// ============================================================================
// Menampilkan sisa waktu MM:SS + progress bar yang berubah warna
// Emerald -> Amber -> Rose saat mendekati 00:00.
// ============================================================================

import { formatCountdown } from '@/lib/utils';

interface ExpiryCountdownProps {
  remainingMs: number;
  totalMs?: number;
}

export function ExpiryCountdown({ remainingMs, totalMs = 30 * 60 * 1000 }: ExpiryCountdownProps) {
  const fraction = Math.max(0, Math.min(1, remainingMs / totalMs));
  const percent = Math.round(fraction * 100);

  let barClass = 'bg-emerald-400';
  let textClass = 'text-emerald-300';
  if (fraction <= 0.15) {
    barClass = 'bg-rose-400';
    textClass = 'text-rose-300';
  } else if (fraction <= 0.4) {
    barClass = 'bg-amber-400';
    textClass = 'text-amber-300';
  }

  const expired = remainingMs <= 0;

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-slate-400">Masa aktif inbox</span>
        <span className={`font-mono text-sm font-semibold tabular-nums ${expired ? 'text-rose-400' : textClass}`}>
          {expired ? 'Kedaluwarsa' : formatCountdown(remainingMs)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-border/60">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${barClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}