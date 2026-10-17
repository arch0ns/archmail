'use client';

// ============================================================================
// ANNE TMAIL - Halaman Utama
// ============================================================================
// Merangkai seluruh komponen: Navbar, panel kontrol email, daftar inbox
// real-time, dan pembaca email. Mengelola pemilihan email + detail.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmailControlPanel } from '@/components/EmailControlPanel';
import { EmailReader } from '@/components/EmailReader';
import { InboxSidebar } from '@/components/InboxSidebar';
import { Navbar } from '@/components/Navbar';
import { useToast } from '@/components/Toast';
import { useInboxSession } from '@/hooks/useInboxSession';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import type { CreateInboxRequest, Domain, EmailDetailResponse, EmailListItem } from '@/types';

export default function HomePage() {
  const { show } = useToast();
  const sound = useNotificationSound(true);

  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmailDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Muat domain aktif untuk dropdown.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/domains', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { domains: Domain[] };
        if (active) setDomains(data.domains ?? []);
      } catch (err) {
        console.error('load domains error', err);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Sesi inbox + realtime.
  const session = useInboxSession({
    onNewEmail: useCallback(
      (email: EmailListItem) => {
        sound.playIncoming();
        show(`Email baru: ${email.subject || '(Tanpa Subjek)'}`, 'info');
      },
      [sound, show],
    ),
  });

  const { inbox, emails, refreshEmails, fetchEmailDetail, deleteEmail, deleteInbox, createInbox, resetInbox } =
    session;

  // Bersihkan detail saat inbox berganti / hilang.
  useEffect(() => {
    if (!inbox) {
      setSelectedId(null);
      setDetail(null);
    }
  }, [inbox]);

  // Bila email terpilih sudah tidak ada di daftar (dihapus), tutup reader.
  useEffect(() => {
    if (selectedId && !emails.some((e) => e.id === selectedId)) {
      setSelectedId(null);
      setDetail(null);
    }
  }, [emails, selectedId]);

  const handleSelect = useCallback(
    async (email: EmailListItem) => {
      setSelectedId(email.id);
      setDetailLoading(true);
      const data = await fetchEmailDetail(email.id);
      setDetailLoading(false);
      if (!data) {
        show('Gagal membuka email (mungkin sudah kedaluwarsa).', 'error');
        setSelectedId(null);
        setDetail(null);
        void refreshEmails();
        return;
      }
      setDetail(data);
    },
    [fetchEmailDetail, refreshEmails, show],
  );

  const handleDeleteEmail = useCallback(
    async (id: string) => {
      await deleteEmail(id);
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
      }
      show('Email dihapus.', 'success');
    },
    [deleteEmail, selectedId, show],
  );

  const handleCreate = useCallback(
    async (payload?: CreateInboxRequest) => {
      sound.unlock();
      const ok = await createInbox(payload);
      if (!ok) show(session.error ?? 'Gagal membuat inbox.', 'error');
      return ok;
    },
    [createInbox, session.error, show, sound],
  );

  const handleReset = useCallback(
    async (payload?: CreateInboxRequest) => {
      const ok = await resetInbox(payload);
      if (ok) {
        setSelectedId(null);
        setDetail(null);
      } else {
        show(session.error ?? 'Gagal menerapkan email baru.', 'error');
      }
      return ok;
    },
    [resetInbox, session.error, show],
  );

  const handleDelete = useCallback(async () => {
    await deleteInbox();
    setSelectedId(null);
    setDetail(null);
  }, [deleteInbox]);

  const unreadCount = useMemo(() => emails.filter((e) => !e.is_read).length, [emails]);

  return (
    <div className="min-h-screen" onClickCapture={sound.unlock}>
      <Navbar
        realtimeConnected={session.realtimeConnected}
        soundEnabled={sound.enabled}
        onToggleSound={sound.toggle}
        unreadCount={unreadCount}
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Panel kontrol */}
        <div className="mb-6">
          <EmailControlPanel
            inbox={inbox}
            domains={domains}
            creating={session.creating}
            remainingMs={session.remainingMs}
            error={session.error}
            onCreate={handleCreate}
            onReset={handleReset}
            onDelete={handleDelete}
          />
        </div>

        {/* Banner kedaluwarsa */}
        {session.isExpired && (
          <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            ⏰ Inbox sebelumnya telah kedaluwarsa dan dihapus. Silakan buat inbox baru di atas.
          </div>
        )}

        {/* Grid: sidebar + reader */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="lg:h-[calc(100vh-14rem)] lg:min-h-[520px]">
            <InboxSidebar
              emails={emails}
              loading={session.loading}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </div>
          <div className="lg:h-[calc(100vh-14rem)] lg:min-h-[520px]">
            <EmailReader
              detail={detail}
              loading={detailLoading}
              onDelete={handleDeleteEmail}
            />
          </div>
        </div>

        <footer className="mt-8 pb-4 text-center text-xs text-slate-500">
          ANNE TMAIL • Inbox kedaluwarsa otomatis dalam 30 menit • Email &amp; lampiran dihapus permanen
        </footer>
      </main>
    </div>
  );
}