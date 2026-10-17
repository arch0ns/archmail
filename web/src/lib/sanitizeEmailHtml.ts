// ============================================================================
// ANNE TMAIL - Email HTML Sanitizer
// ============================================================================
// Tugas:
//   1. Mengganti referensi gambar inline `cid:xxx` dengan Signed URL asli.
//   2. Membersihkan HTML dari konten berbahaya (script, on*, javascript:, dll)
//      memakai isomorphic-dompurify.
//   3. Memaksa semua <a> memiliki target="_blank" rel="noopener noreferrer nofollow".
// ============================================================================

import DOMPurify from 'isomorphic-dompurify';

let hookInstalled = false;

/** Pasang hook sekali (global) untuk mengamankan atribut anchor. */
function ensureHook(): void {
  if (hookInstalled) return;
  hookInstalled = true;

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node instanceof Element && node.tagName === 'A') {
      const href = node.getAttribute('href') ?? '';
      // Tolak skema berbahaya eksplisit (jaga-jaga selain filter DOMPurify).
      if (/^\s*javascript:/i.test(href)) {
        node.removeAttribute('href');
      } else {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer nofollow');
      }
    }
  });
}

/** Peta content-id -> signed url. */
export type CidMap = Record<string, string>;

/**
 * Ganti `cid:xxx` di dalam HTML dengan URL dari peta.
 * `xxx` dicocokkan dengan & tanpa kurung siku.
 */
export function resolveCidReferences(html: string, cidMap: CidMap): string {
  if (!html || Object.keys(cidMap).length === 0) return html;

  return html.replace(/cid:([^"'\s)>]+)/gi, (match, rawCid: string) => {
    const candidates = [rawCid, decodeURIComponent(rawCid)];
    for (const cid of candidates) {
      if (cidMap[cid]) return cidMap[cid];
    }
    return match;
  });
}

const SANITIZE_CONFIG = {
  FORBID_TAGS: ['script', 'object', 'embed', 'form', 'iframe', 'base', 'meta', 'link'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'oninput', 'onsubmit'],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ADD_ATTR: ['target', 'rel'],
  USE_PROFILES: { html: true },
};

/**
 * Sanitasi HTML email.
 * @param html   HTML mentah dari email
 * @param cidMap peta content-id -> signed url (opsional)
 * @returns HTML aman untuk dirender di iframe sandbox
 */
export function sanitizeEmailHtml(html: string, cidMap: CidMap = {}): string {
  ensureHook();

  const withResolvedCid = resolveCidReferences(html ?? '', cidMap);
  const cleaned = DOMPurify.sanitize(withResolvedCid, SANITIZE_CONFIG) as unknown as string;

  return cleaned;
}