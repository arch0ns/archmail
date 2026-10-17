// ============================================================================
// ANNE TMAIL - Username Validator & Blocklist
// ============================================================================

/** Kata yang tidak boleh dipakai sebagai username (case-insensitive). */
export const RESERVED_USERNAMES: readonly string[] = [
  'admin',
  'administrator',
  'support',
  'root',
  'contact',
  'help',
  'security',
  'postmaster',
  'webmaster',
  'hostmaster',
  'abuse',
  'noc',
  'billing',
  'sales',
  'info',
  'owner',
  'system',
  'official',
  'staff',
  'moderator',
  'dev',
  'api',
  'mail',
  'email',
  'smtp',
  'imap',
  'pop3',
];

/** Prefix sensitif yang tidak boleh diawali username. */
export const RESERVED_PREFIXES: readonly string[] = [
  'admin-',
  'admin.',
  'support-',
  'support.',
  'root-',
  'root.',
  'official-',
  'official.',
];

/**
 * Regex validasi username final:
 *   - panjang total 3-32 karakter
 *   - diawali & diakhiri huruf/angka
 *   - boleh mengandung a-z, 0-9, titik, strip, garis bawah
 */
export const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/;

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;

export interface UsernameValidationResult {
  valid: boolean;
  /** Username yang sudah dinormalisasi (lowercase + trim). */
  normalized: string;
  /** Alasan penolakan bila tidak valid. */
  reason?: string;
}

/** Normalisasi input username: trim + lowercase. */
export function normalizeUsername(input: string): string {
  return (input ?? '').trim().toLowerCase();
}

/** Cek apakah username persis sama dengan kata terlarang. */
export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.includes(username);
}

/** Cek apakah username diawali prefix sensitif. */
export function hasReservedPrefix(username: string): boolean {
  return RESERVED_PREFIXES.some((prefix) => username.startsWith(prefix));
}

/**
 * Validasi lengkap username.
 * Urutan: kosong -> panjang -> karakter -> blocklist.
 */
export function validateUsername(input: string): UsernameValidationResult {
  const username = normalizeUsername(input);

  if (!username) {
    return { valid: false, normalized: username, reason: 'Username wajib diisi.' };
  }

  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return {
      valid: false,
      normalized: username,
      reason: `Username harus ${USERNAME_MIN}-${USERNAME_MAX} karakter.`,
    };
  }

  if (!USERNAME_REGEX.test(username)) {
    return {
      valid: false,
      normalized: username,
      reason: 'Hanya huruf kecil, angka, titik, strip, dan garis bawah. Tidak boleh diawali/diakhiri simbol.',
    };
  }

  if (isReservedUsername(username)) {
    return { valid: false, normalized: username, reason: 'Username ini tidak diizinkan (kata terlarang).' };
  }

  if (hasReservedPrefix(username)) {
    return {
      valid: false,
      normalized: username,
      reason: 'Username tidak boleh diawali dengan admin-, support-, root-, atau official-.',
    };
  }

  return { valid: true, normalized: username };
}