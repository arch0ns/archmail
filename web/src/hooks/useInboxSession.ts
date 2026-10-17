'use client';

// ============================================================================
// ANNE TMAIL - useInboxSession
// ============================================================================
// State utama aplikasi:
//   * sesi inbox (id, alamat, token, expiry) + persistensi localStorage
//   * daftar email + integrasi Supabase Realtime (WebSocket)
//   * countdown 30 menit & auto-clear saat kedaluwarsa
//   * aksi: buat / reset / hapus inbox, ambil detail, hapus email, mark read
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';
import type {
  CreateInboxRequest,
  EmailDetailResponse,
  EmailListItem,
  SessionPersisted,
} from '@/types';

const STORAGE_KEY = 'anne-tmail-session-v1';
const POLL_INTERVAL_MS = 15_000;

export interface UseInboxSessionResult {
  inbox: SessionPersisted | null;
  emails: EmailListItem[];
  loading: boolean;
  creating: boolean;
  error: string | null;
  remainingMs: number;
  isExpired: boolean;
  realtimeConnected: boolean;
  unreadCount: number;
  createInbox: (payload?: CreateInboxRequest) => Promise<boolean>;
  resetInbox: (payload?: CreateInboxRequest) => Promise<boolean>;
  deleteInbox: () => Promise<void>;
  refreshEmails: () => Promise<void>;
  fetchEmailDetail: (id: string) => Promise<EmailDetailResponse | null>;
  deleteEmail: (id: string) => Promise<void>;
  markRead: (id: string, isRead?: boolean) => Promise<void>;
}

export interface UseInboxSessionOptions {
  /** Dipanggil saat email baru tiba (mis. untuk memutar suara). */
  onNewEmail?: (email: EmailListItem) => void;
}

function loadPersisted(): SessionPersisted | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionPersisted;
    if (!parsed?.inboxId || !parsed?.accessToken) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist(session: SessionPersisted | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore quota / private mode
  }
}

export function useInboxSession(options: UseInboxSessionOptions = {}): UseInboxSessionResult {
  const { onNewEmail } = options;

  const [inbox, setInbox] = useState<SessionPersisted | null>(null);
  const [emails, setEmails] = useState<EmailListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const onNewEmailRef = useRef(onNewEmail);
  useEffect(() => {
    onNewEmailRef.current = onNewEmail;
  }, [onNewEmail]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // -------------------------------------------------------------------------
  // Boot: muat sesi tersimpan
  // -------------------------------------------------------------------------
  useEffect(() => {
    setInbox(loadPersisted());
  }, []);

  // -------------------------------------------------------------------------
  // Tick countdown tiap detik
  // -------------------------------------------------------------------------
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remainingMs = useMemo(() => {
    if (!inbox) return 0;
    return Math.max(0, new Date(inbox.expiresAt).getTime() - now);
  }, [inbox, now]);

  const isExpired = Boolean(inbox) && remainingMs <= 0;

  // -------------------------------------------------------------------------
  // Fetch daftar email
  // -------------------------------------------------------------------------
  const refreshEmails = useCallback(async () => {
    const session = inbox;
    if (!session) return;

    setLoading(true);
    try {
      const res = await fetch('/api/inbox/emails', {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: 'no-store',
      });
      if (res.status === 401) {
        // Sesi tidak valid / kedaluwarsa di server.
        setInbox(null);
        persist(null);
        setEmails([]);
        return;
      }
      if (!res.ok) throw new Error('Gagal memuat email.');
      const data = (await res.json()) as { emails: EmailListItem[] };
      seenIdsRef.current = new Set(data.emails.map((e) => e.id));
      setEmails(data.emails);
    } catch (err) {
      console.error('refreshEmails error', err);
      setError('Gagal memuat daftar email.');
    } finally {
      setLoading(false);
    }
  }, [inbox]);

  // Muat ulang daftar saat inbox berubah.
  useEffect(() => {
    if (inbox) {
      void refreshEmails();
    } else {
      setEmails([]);
    }
  }, [inbox, refreshEmails]);

  // -------------------------------------------------------------------------
  // Supabase Realtime: subscribe INSERT baru pada inbox ini
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!inbox || !isSupabaseConfigured) {
      setRealtimeConnected(false);
      return;
    }

    let cancelled = false;
    let client: SupabaseClient;
    try {
      client = createBrowserSupabaseClient(inbox.accessToken);
    } catch (err) {
      console.error('realtime client error', err);
      setRealtimeConnected(false);
      return;
    }
    clientRef.current = client;

    const channel = client
      .channel(`inbox-${inbox.inboxId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'emails',
          filter: `inbox_id=eq.${inbox.inboxId}`,
        },
        (payload) => {
          const row = payload.new as EmailListItem;
          if (!row?.id || seenIdsRef.current.has(row.id)) return;
          seenIdsRef.current.add(row.id);
          setEmails((prev) => [row, ...prev]);
          onNewEmailRef.current?.(row);
        },
      )
      .subscribe((status) => {
        if (cancelled) return;
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      cancelled = true;
      setRealtimeConnected(false);
      if (channelRef.current) {
        void client.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      clientRef.current = null;
    };
  }, [inbox]);

  // -------------------------------------------------------------------------
  // Polling fallback (bila realtime belum tersambung)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!inbox || realtimeConnected) return;
    const timer = setInterval(() => {
      void refreshEmails();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [inbox, realtimeConnected, refreshEmails]);

  // -------------------------------------------------------------------------
  // Auto-clear sesi saat kedaluwarsa
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!inbox || !isExpired) return;
    // Bersihkan sesi lokal; inbox akan dihapus server-side oleh cron.
    setInbox(null);
    persist(null);
    setEmails([]);
  }, [inbox, isExpired]);

  // -------------------------------------------------------------------------
  // Aksi
  // -------------------------------------------------------------------------
  const createInbox = useCallback(async (payload: CreateInboxRequest = {}): Promise<boolean> => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? 'Gagal membuat inbox.');
        return false;
      }

      const session: SessionPersisted = {
        inboxId: data.inboxId,
        emailAddress: data.emailAddress,
        accessToken: data.accessToken,
        expiresAt: data.expiresAt,
      };
      persist(session);
      seenIdsRef.current = new Set();
      setEmails([]);
      setInbox(session);
      return true;
    } catch (err) {
      console.error('createInbox error', err);
      setError('Kesalahan jaringan. Coba lagi.');
      return false;
    } finally {
      setCreating(false);
    }
  }, []);

  const deleteInbox = useCallback(async (): Promise<void> => {
    const session = inbox;
    // Bersihkan lokal lebih dulu agar UI responsif.
    setInbox(null);
    persist(null);
    setEmails([]);

    if (!session) return;
    try {
      await fetch('/api/inbox', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
    } catch (err) {
      console.error('deleteInbox error', err);
    }
  }, [inbox]);

  const resetInbox = useCallback(
    async (payload: CreateInboxRequest = {}): Promise<boolean> => {
      await deleteInbox();
      return createInbox(payload);
    },
    [deleteInbox, createInbox],
  );

  const fetchEmailDetail = useCallback(
    async (id: string): Promise<EmailDetailResponse | null> => {
      const session = inbox;
      if (!session) return null;
      try {
        const res = await fetch(`/api/emails/${id}`, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
          cache: 'no-store',
        });
        if (!res.ok) return null;
        const data = (await res.json()) as EmailDetailResponse;
        // Update status read di daftar.
        setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, is_read: true } : e)));
        return data;
      } catch (err) {
        console.error('fetchEmailDetail error', err);
        return null;
      }
    },
    [inbox],
  );

  const deleteEmail = useCallback(
    async (id: string): Promise<void> => {
      const session = inbox;
      if (!session) return;
      setEmails((prev) => prev.filter((e) => e.id !== id));
      try {
        await fetch(`/api/emails/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.accessToken}` },
        });
      } catch (err) {
        console.error('deleteEmail error', err);
        void refreshEmails();
      }
    },
    [inbox, refreshEmails],
  );

  const markRead = useCallback(
    async (id: string, isRead = true): Promise<void> => {
      const session = inbox;
      if (!session) return;
      setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, is_read: isRead } : e)));
      try {
        await fetch(`/api/emails/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify({ is_read: isRead }),
        });
      } catch (err) {
        console.error('markRead error', err);
      }
    },
    [inbox],
  );

  const unreadCount = useMemo(() => emails.filter((e) => !e.is_read).length, [emails]);

  return {
    inbox,
    emails,
    loading,
    creating,
    error,
    remainingMs,
    isExpired,
    realtimeConnected,
    unreadCount,
    createInbox,
    resetInbox,
    deleteInbox,
    refreshEmails,
    fetchEmailDetail,
    deleteEmail,
    markRead,
  };
}