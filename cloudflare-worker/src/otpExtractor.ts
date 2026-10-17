// ============================================================================
// ANNE TMAIL - OTP Extractor
// ============================================================================
// Mendeteksi kode OTP 4-8 digit di dalam body email.
// Strategi:
//   1. Cari angka 4-8 digit yang dekat dengan kata kunci OTP (paling akurat).
//   2. Jika tidak ada, ambil angka 4-8 digit mandiri pertama yang ditemukan.
// ============================================================================

/** Kata kunci yang biasanya mendahului / mengikuti kode OTP. */
const OTP_KEYWORDS = [
  'otp',
  'code',
  'kode',
  'verification',
  'verifikasi',
  'verify',
  'passcode',
  'pin',
  'token',
  'kode verifikasi',
  'security code',
  'one time password',
  'one-time password',
];

/** Pola angka OTP: 4 sampai 8 digit, dibatasi batas non-digit. */
const DIGIT_PATTERN = /(?<!\d)(\d{4,8})(?!\d)/g;

/** Buang tag HTML agar pencarian teks lebih bersih. */
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ekstrak kode OTP dari body_text dan/atau body_html.
 * @returns kode OTP (string) atau null bila tidak ditemukan.
 */
export function extractOtp(text: string | null | undefined, html?: string | null): string | null {
  const haystack = [text ?? '', stripHtml(html ?? '')].join('\n').toLowerCase();
  if (!haystack.trim()) return null;

  // 1) Cari kode di sekitar kata kunci OTP.
  for (const keyword of OTP_KEYWORDS) {
    const idx = haystack.indexOf(keyword);
    if (idx === -1) continue;

    // Ambil jendela teks di sekitar kata kunci lalu cari angka di dalamnya.
    const windowText = haystack.slice(Math.max(0, idx - 60), idx + keyword.length + 60);
    const matches = [...windowText.matchAll(DIGIT_PATTERN)];
    if (matches.length > 0) {
      // Pilih kandidat terdekat dengan kata kunci.
      let best = matches[0][1];
      let bestDist = Infinity;
      const absIdx = idx - Math.max(0, idx - 60);
      for (const m of matches) {
        const dist = Math.abs((m.index ?? 0) - absIdx);
        if (dist < bestDist) {
          bestDist = dist;
          best = m[1];
        }
      }
      return best;
    }
  }

  // 2) Fallback: angka 4-8 digit mandiri pertama.
  const fallback = haystack.match(DIGIT_PATTERN);
  return fallback && fallback.length > 0 ? fallback[0] : null;
}