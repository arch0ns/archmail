'use client';

// ============================================================================
// ANNE TMAIL - Toast Notification
// ============================================================================
// Provider + hook `useToast()` untuk menampilkan notifikasi pop-up
// (mis. saat menyalin alamat email / OTP, atau saat email baru masuk).
// ============================================================================

import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ToastItem, ToastKind } from '@/types';

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_STYLES: Record<ToastKind, string> = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  error: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
  info: 'border-brand/40 bg-brand/10 text-brand-soft',
};

const KIND_ICON: Record<ToastKind, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = `t-${Date.now()}-${counter.current++}`;
      setToasts((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => remove(id), 3200);
    },
    [remove],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${KIND_STYLES[toast.kind]}`}
              role="status"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current/30 text-xs">
                {KIND_ICON[toast.kind]}
              </span>
              <span className="flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={() => remove(toast.id)}
                className="shrink-0 text-current/70 transition hover:text-current"
                aria-label="Tutup notifikasi"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast harus dipakai di dalam <ToastProvider>');
  }
  return ctx;
}