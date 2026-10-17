'use client';

// ============================================================================
// ANNE TMAIL - Notification Sound (Web Audio API)
// ============================================================================
// Menghasilkan denting lembut dual-tone tanpa aset MP3 eksternal.
// Dipicu saat email baru masuk. Mendukung toggle on/off & unlock AudioContext
// yang dibutuhkan browser sebelum bisa memutar audio.
// ============================================================================

import { useCallback, useRef, useState } from 'react';

export interface UseNotificationSound {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (value: boolean) => void;
  playIncoming: () => void;
  /** Panggil pada interaksi user pertama untuk unlock AudioContext. */
  unlock: () => void;
}

export function useNotificationSound(initialEnabled = true): UseNotificationSound {
  const [enabled, setEnabledState] = useState(initialEnabled);
  const ctxRef = useRef<AudioContext | null>(null);

  /** Pastikan AudioContext tersedia (dan di-resume). */
  const getContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
    }
    if (ctxRef.current.state === 'suspended') {
      void ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  /** Putar satu nada dengan envelope gain. */
  const playTone = useCallback(
    (ctx: AudioContext, frequency: number, startAt: number, duration: number, peak: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime + startAt);

      const t0 = ctx.currentTime + startAt;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    },
    [],
  );

  const playIncoming = useCallback(() => {
    if (!enabled) return;
    const ctx = getContext();
    if (!ctx) return;
    // Dual-tone chime: E6 -> A6, lembut.
    playTone(ctx, 1318.51, 0, 0.18, 0.12);
    playTone(ctx, 1760.0, 0.14, 0.28, 0.1);
  }, [enabled, getContext, playTone]);

  const unlock = useCallback(() => {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
  }, [getContext]);

  const toggle = useCallback(() => {
    setEnabledState((prev) => {
      const next = !prev;
      if (next) unlock();
      return next;
    });
  }, [unlock]);

  const setEnabled = useCallback(
    (value: boolean) => {
      setEnabledState(value);
      if (value) unlock();
    },
    [unlock],
  );

  return { enabled, toggle, setEnabled, playIncoming, unlock };
}