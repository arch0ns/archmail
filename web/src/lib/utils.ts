// ============================================================================
// ANNE TMAIL - Shared UI Utilities
// ============================================================================

import { clsx, type ClassValue } from 'clsx';

/** Gabung className (clsx wrapper). */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** Format waktu relatif dalam Bahasa Indonesia. */
export function formatRelativeTime(input: string | number | Date, now: number = Date.now()): string {
  const then = typeof input === 'number' ? input : new Date(input).getTime();
  const diffSeconds = Math.max(0, Math.floor((now - then) / 1000));

  if (diffSeconds < 45) return 'Baru saja';
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 1) return 'Kurang dari 1 menit lalu';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

/** Format ukuran file (byte -> B / KB / MB). */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Format sisa waktu menjadi MM:SS. */
export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Format tanggal & waktu lengkap (locale ID). */
export function formatFullDateTime(input: string | number | Date): string {
  const date = typeof input === 'number' ? new Date(input) : new Date(input);
  return date.toLocaleString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Buat username acak 8-10 karakter (aman). */
export function generateRandomUsername(length = 9): string {
  const len = Math.min(10, Math.max(8, length));
  let out = '';
  const cryptoObj = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    const arr = new Uint8Array(len);
    cryptoObj.getRandomValues(arr);
    for (let i = 0; i < len; i++) {
      out += ALPHABET[arr[i] % ALPHABET.length];
    }
    // Pastikan diawali huruf agar lolos regex.
    if (/^[0-9]/.test(out)) out = 'u' + out.slice(1);
    return out;
  }

  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  if (/^[0-9]/.test(out)) out = 'u' + out.slice(1);
  return out;
}

/** Salin teks ke clipboard, dengan fallback. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // lanjut ke fallback
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/** Ambil inisial nama pengirim untuk avatar. */
export function getInitials(name: string | null, address: string): string {
  const source = (name ?? '').trim() || address;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}