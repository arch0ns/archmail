# PRD & AI Agent Blueprint: ANNE TMAIL (Full-Featured Secure Real-Time Temp Mail)

## 1. System Role & Vibecoding Instructions (Untuk OpenCode Agent)
Kamu adalah Senior Full-Stack Serverless & Security Engineer. Tugasmu adalah membangun aplikasi **Temporary Email Modern (ANNE TMAIL Clone)** yang aman, cepat, dan kaya fitur menggunakan arsitektur monorepo:
1. **Cloudflare Email Worker** (Catch-All SMTP, `postal-mime` parser, CID & Attachment uploader ke Supabase Storage).
2. **Supabase** (PostgreSQL Database, Row Level Security berbasis Token, Realtime WebSocket, Private Storage Bucket dengan Signed URL).
3. **Vercel / Next.js App Router** (Tailwind CSS, Framer Motion, Web Audio API, API Routes dengan Rate Limiter, Vercel Cron Job).

---

## 2. Daftar Fitur & Keunggulan Wajib (Feature Checklist)

OpenCode WAJIB mengimplementasikan seluruh fitur berikut tanpa terkecuali:

### 📧 Pembuatan Temporary Email
- [x] **1-Click Random Email:** Buat *username* acak otomatis hanya dengan satu klik.
- [x] **Custom Username:** Pengguna dapat mengetik *username* sesuai keinginan.
- [x] **Validasi Otomatis:** Sanitasi input (hanya huruf kecil `a-z`, angka `0-9`, titik `.`, strip `-`, garis bawah `_`, panjang 3–32 karakter).
- [x] **Proteksi Username Khusus (Blocklist):** Tolak pembuatan *username* sensitif seperti `admin`, `support`, `root`, `contact`, `help`, `security`, `postmaster`, `webmaster`, `abuse`, `noc`, `billing`, `info`, `owner`, `system`, `official`.
- [x] **Multi-Domain & Random Domain:** Mendukung pemilihan banyak domain dari database serta opsi **"🎲 Random Domain"** untuk memilih domain secara acak otomatis.

### ⏳ Sistem Expired Otomatis (30 Menit)
- [x] **Masa Aktif 30 Menit:** Setiap *inbox* memiliki waktu kedaluwarsa `expires_at = created_at + 30 minutes` lengkap dengan *countdown timer* berjalan di UI.
- [x] **Auto-Purge Menyeluruh:** Saat masa aktif 30 menit habis (atau pengguna menekan tombol Hapus Inbox), seluruh data *inbox*, daftar email, dan seluruh file lampiran di Supabase Storage otomatis terhapus bersih.
- [x] **Waktu Dinamis:** Menampilkan waktu email diterima secara dinamis (contoh: *"Baru saja"*, *"3 menit yang lalu"*).

### ⚡ Real-Time Inbox
- [x] **Zero-Refresh Realtime:** Email baru muncul otomatis via Supabase Realtime WebSocket.
- [x] **Animasi Halus:** Transisi animasi *slide/fade-in* yang halus saat email baru masuk ke daftar.
- [x] **Indikator Radar Aktif:** Animasi radar berdenyut (*pulsing indicator*) saat *inbox* masih kosong menunggu email.
- [x] **Notifikasi Suara Otomatis:** Memainkan efek suara denting lembut (menggunakan Web Audio API synthesizer agar tidak bergantung pada aset MP3 eksternal) saat email baru mendarat.
- [x] **Status Read & Unread:** Penanda email belum dibaca (*unread badge/dot*) yang otomatis berubah menjadi `is_read = true` saat email dibuka.

### 🔒 Keamanan Berlapis
- [x] **Access Token & IDOR Protection:** Setiap pembuatan *inbox* menghasilkan `access_token` rahasia (UUIDv4/ cryptographic hex 64-char). Pengguna lain TIDAK BISA mengintip *inbox* meskipun mengetahui alamat emailnya tanpa memiliki `access_token` yang valid.
- [x] **XSS Protection & Sanitasi HTML:** Seluruh `body_html` dibersihkan menggunakan `isomorphic-dompurify`.
- [x] **Sandboxed Rendering:** Email HTML dirender di dalam `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox">` (tanpa `allow-scripts` dan tanpa `allow-same-origin`).
- [x] **Safe External Links:** Semua tag `<a href="...">` di dalam email otomatis dipaksa memiliki atribut `target="_blank" rel="noopener noreferrer nofollow"`.
- [x] **Rate Limit API:** Pembatasan frekuensi *request* per IP pada endpoint pembuatan *inbox* dan *fetch* data untuk mencegah spam & *brute-force*.

### 📂 Lampiran Aman & 📨 Tampilan Email Akurat
- [x] **Supabase Private Storage:** Lampiran disimpan di *private bucket* `email-attachments`.
- [x] **Signed URL Terbatas:** File lampiran hanya bisa diunduh/dilihat melalui *Signed URL* yang berlaku selama 10 menit.
- [x] **Support CID Inline Images:** Gambar di dalam badan email yang menggunakan referensi `src="cid:..."` otomatis dipetakan ke *Signed URL* lampiran terkait sehingga tampil utuh dan akurat.

### 🚀 Kemudahan Penggunaan
- [x] **1-Click Copy & Toast Notification:** Salin alamat email atau kode OTP dengan satu klik disertai *toast notification* interaktif.
- [x] **Instant Reset (Hapus & Buat Baru):** Hapus *inbox* lama beserta seluruh isinya di server dan ganti dengan *inbox* baru dalam hitungan milidetik.

---

## 3. Struktur Direktori Monorepo

```text
anne-tmail/
├── PRD.md
├── .gitignore
├── supabase/
│   ├── 01_schema_and_storage.sql       # Tabel domains, inboxes, emails, attachments + Storage Bucket
│   ├── 02_rls_policies.sql             # Proteksi RLS & fungsi validasi Access Token (Anti-IDOR)
│   └── 03_seed_domains.sql             # Data awal multi-domain
│
├── cloudflare-worker/
│   ├── package.json
│   ├── tsconfig.json
│   ├── wrangler.toml
│   └── src/
│       ├── index.ts                    # Handler SMTP Catch-All, cek inbox aktif, upload attachment
│       ├── mimeParser.ts               # Wrapper postal-mime & ekstraksi CID / attachment
│       ├── otpExtractor.ts             # Ekstraktor kode OTP 4-8 digit
│       └── types.ts
│
└── web/
    ├── package.json
    ├── tsconfig.json
    ├── next.config.mjs
    ├── vercel.json                     # Konfigurasi Vercel Cron Job (/api/cron/cleanup)
    ├── tailwind.config.ts
    ├── .env.example
    └── src/
        ├── app/
        │   ├── globals.css
        │   ├── layout.tsx
        │   ├── page.tsx                # Halaman utama aplikasi Temp Mail
        │   └── api/
        │       ├── domains/route.ts    # GET daftar domain aktif
        │       ├── inbox/
        │       │   ├── route.ts        # POST buat inbox baru (Validasi + Blocklist + Rate Limit) & DELETE hapus inbox
        │       │   └── emails/route.ts # GET daftar email (Wajib Header Authorization Bearer AccessToken)
        │       ├── emails/[id]/
        │       │   └── route.ts        # GET detail email + Signed URLs & PATCH status Read + DELETE email
        │       └── cron/
        │           └── cleanup/route.ts# GET Cron Job penghapus inbox, email, & file Storage > 30 menit
        ├── components/
        │   ├── Navbar.tsx              # Header, status radar realtime, toggle suara notifikasi
        │   ├── EmailControlPanel.tsx   # Generator email, custom username, multi-domain, tombol Random Domain & Reset
        │   ├── ExpiryCountdown.tsx     # Progress bar & hitung mundur 30 menit masa aktif inbox
        │   ├── InboxSidebar.tsx        # Daftar email (Animasi masuk, filter Read/Unread, badge OTP, waktu relatif)
        │   ├── EmailReader.tsx         # Sandboxed HTML viewer (CID resolved), Plain text tab, & daftar Attachment
        │   └── Toast.tsx               # Notifikasi pop-up saat copy email / email baru masuk
        ├── hooks/
        │   ├── useInboxSession.ts      # State inbox, token, countdown 30 menit, & integrasi Supabase Realtime
        │   └── useNotificationSound.ts # Web Audio API sound generator untuk notifikasi email masuk
        ├── lib/
        │   ├── supabaseAdmin.ts        # Supabase client dengan SERVICE_ROLE_KEY (Hanya untuk Server API Routes)
        │   ├── supabaseClient.ts       # Supabase client publik dengan header x-inbox-token untuk Realtime
        │   ├── rateLimit.ts            # In-memory / LRU IP Rate Limiter untuk API Routes
        │   ├── usernameValidator.ts    # Regex validator & daftar kata terlarang (admin, root, support, dll.)
        │   └── sanitizeEmailHtml.ts    # DOMPurify + rewrite link target="_blank" + resolusi cid: image
        └── types/
            └── index.ts
```

---

## 4. Spesifikasi Database & Storage (`supabase/`)

### A. Skema Tabel (`supabase/01_schema_and_storage.sql`)

1. **Tabel `public.domains`**
   - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `domain_name`: `TEXT UNIQUE NOT NULL`
   - `is_active`: `BOOLEAN DEFAULT true NOT NULL`
   - `created_at`: `TIMESTAMPTZ DEFAULT now() NOT NULL`

2. **Tabel `public.inboxes` (Kunci Proteksi IDOR & Expired 30 Menit)**
   - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `email_address`: `TEXT NOT NULL` (Indexed)
   - `access_token`: `TEXT UNIQUE NOT NULL` (64-char hex token rahasia)
   - `created_at`: `TIMESTAMPTZ DEFAULT now() NOT NULL`
   - `expires_at`: `TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes')`

3. **Tabel `public.emails`**
   - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `inbox_id`: `UUID NOT NULL REFERENCES public.inboxes(id) ON DELETE CASCADE`
   - `sender_name`: `TEXT`
   - `sender_address`: `TEXT NOT NULL`
   - `recipient`: `TEXT NOT NULL`
   - `subject`: `TEXT DEFAULT '(Tanpa Subjek)'`
   - `body_text`: `TEXT DEFAULT ''`
   - `body_html`: `TEXT DEFAULT ''`
   - `otp_code`: `TEXT NULL`
   - `is_read`: `BOOLEAN DEFAULT false NOT NULL`
   - `has_attachments`: `BOOLEAN DEFAULT false NOT NULL`
   - `created_at`: `TIMESTAMPTZ DEFAULT now() NOT NULL`

4. **Tabel `public.attachments`**
   - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `email_id`: `UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE`
   - `inbox_id`: `UUID NOT NULL REFERENCES public.inboxes(id) ON DELETE CASCADE`
   - `file_name`: `TEXT NOT NULL`
   - `mime_type`: `TEXT NOT NULL`
   - `file_size`: `INTEGER NOT NULL`
   - `content_id`: `TEXT NULL` (Untuk pencocokan gambar inline `cid:...`, disimpan tanpa tanda `<` dan `>`)
   - `storage_path`: `TEXT NOT NULL` (Path di dalam bucket `email-attachments`, contoh: `{inbox_id}/{email_id}/{file_name}`)
   - `created_at`: `TIMESTAMPTZ DEFAULT now() NOT NULL`

5. **Supabase Storage Bucket**
   - Buat *private bucket* bernama `email-attachments` (`public = false`) dengan batas ukuran file 10 MB per lampiran.

### B. Proteksi Row Level Security (`supabase/02_rls_policies.sql`)
- Aktifkan RLS pada semua tabel (`domains`, `inboxes`, `emails`, `attachments`).
- Agar **Supabase Realtime** aman dari IDOR, izinkan `SELECT` pada `public.emails` HANYA jika header request `x-inbox-token` cocok dengan `access_token` milik `inbox_id` yang belum kedaluwarsa:
  ```sql
  CREATE POLICY "Read emails with valid inbox token" ON public.emails
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.inboxes i
      WHERE i.id = emails.inbox_id
        AND i.access_token = (current_setting('request.headers', true)::json->>'x-inbox-token')
        AND i.expires_at > now()
    )
  );
  ```
- Aktifkan publikasi Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.emails;`

---

## 5. Spesifikasi Cloudflare Email Worker (`cloudflare-worker/`)

Ketika email masuk ke `*@domain-apa-saja.com`:
1. Normalisasi alamat tujuan: `const recipient = message.to.toLowerCase().trim()`.
2. **Cek Inbox Aktif di Supabase:**
   - Query ke REST API Supabase tabel `inboxes` dengan filter `email_address=eq.${recipient}` dan `expires_at=gt.${new Date().toISOString()}` (urutkan dari yang terbaru, ambil 1).
   - Jika **tidak ada inbox aktif** (atau sudah *expired* lewat 30 menit), langsung abaikan/tolak email (`return`) agar database dan storage tidak dipenuhi spam.
3. **Optimasi Parsing Email (`postal-mime`):**
   - Parse `message.raw` menggunakan `PostalMime`.
   - Ekstrak `subject`, `from`, `text`, `html`, dan `attachments`.
   - Jalankan `extractOtp()` untuk mendeteksi kode OTP jika ada.
4. **Simpan Rekaman Email ke Tabel `public.emails`:**
   - Lakukan `POST` ke `/rest/v1/emails` dengan `Prefer: return=representation` untuk mendapatkan `email.id`.
5. **Upload Lampiran & Inline CID Image ke Supabase Storage:**
   - Jika `parsed.attachments` tidak kosong (maksimal 5 file, masing-masing < 10 MB):
   - Unggah setiap *buffer* lampiran ke `${env.SUPABASE_URL}/storage/v1/object/email-attachments/${inbox.id}/${email.id}/${safeFileName}` menggunakan `SUPABASE_SERVICE_ROLE_KEY`.
   - Simpan metadata lampiran (termasuk `contentId` yang sudah dibersihkan dari kurung siku `<>`) ke tabel `public.attachments`.

---

## 6. Spesifikasi Backend API & Keamanan (`web/src/app/api/`)

### 1. Validasi & Blocklist Username (`src/lib/usernameValidator.ts`)
- Daftar kata terlarang (`RESERVED_USERNAMES`):
  `['admin', 'administrator', 'support', 'root', 'contact', 'help', 'security', 'postmaster', 'webmaster', 'hostmaster', 'abuse', 'noc', 'billing', 'sales', 'info', 'owner', 'system', 'official', 'staff', 'moderator', 'dev', 'api', 'mail', 'email', 'smtp', 'imap', 'pop3']`
- Tolak jika *username* persis sama dengan kata di atas ATAU diawali dengan `admin-`, `support-`, `root-`, `official-`.
- Validasi Regex: `/^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/`.

### 2. Rate Limiter (`src/lib/rateLimit.ts`)
- Batasi IP pengguna maksimal:
  - **10 request / menit** untuk pembuatan inbox baru (`POST /api/inbox`).
  - **60 request / menit** untuk pembacaan email (`GET /api/inbox/emails` & `GET /api/emails/[id]`).
- Kembalikan HTTP `429 Too Many Requests` jika melampaui batas.

### 3. Pembuatan & Penghapusan Inbox (`src/app/api/inbox/route.ts`)
- **`POST /api/inbox`**:
  - Menerima `{ username?, domain?, randomDomain?: boolean }`.
  - Jika `username` kosong, buat string acak 8–10 karakter yang aman. Jika diisi, jalankan `validateUsername()`.
  - Jika `randomDomain === true` atau `domain` tidak dipilih, pilih satu domain secara acak dari daftar domain aktif di Supabase.
  - Buat `access_token` menggunakan `crypto.randomBytes(32).toString('hex')`.
  - Set `expires_at` ke 30 menit dari waktu sekarang.
  - Simpan ke `public.inboxes` dan kembalikan `{ inboxId, emailAddress, accessToken, expiresAt }`.
- **`DELETE /api/inbox`**:
  - Verifikasi header `Authorization: Bearer <accessToken>`.
  - Hapus semua file di Supabase Storage dalam folder `{inboxId}/` terlebih dahulu, lalu hapus baris di `public.inboxes` (otomatis menghapus `emails` dan `attachments` karena `ON DELETE CASCADE`).

### 4. Detail Email, Sanitasi XSS, & Resolusi CID + Signed URL (`src/app/api/emails/[id]/route.ts`)
- Verifikasi `Authorization: Bearer <accessToken>` milik `inbox_id` dari email tersebut (mencegah serangan IDOR).
- Tandai email sebagai sudah dibaca (`UPDATE public.emails SET is_read = true WHERE id = ...`).
- Ambil semua baris `public.attachments` untuk `email_id` ini.
- Untuk setiap lampiran, panggil `supabaseAdmin.storage.from('email-attachments').createSignedUrl(att.storage_path, 600)` (berlaku 10 menit).
- **Resolusi Gambar Inline (`cid:`):**
  - Jika `att.content_id` ada di dalam `body_html` (misalnya `src="cid:logo123"`), ganti string `cid:logo123` di dalam HTML dengan *Signed URL* yang baru dibuat.
- **Sanitasi HTML (`src/lib/sanitizeEmailHtml.ts`):**
  - Gunakan `DOMPurify` untuk menghapus `<script>`, `onload`, `onerror`, `javascript:`, `<object>`, `<embed>`, dan `<form>`.
  - Tambahkan hook `DOMPurify` agar semua elemen `<a>` wajib memiliki `target="_blank"` dan `rel="noopener noreferrer nofollow"`.

### 5. Cron Job Pembersih Otomatis (`src/app/api/cron/cleanup/route.ts` & `vercel.json`)
- Cari seluruh baris di `public.inboxes` yang `expires_at < now()`.
- Ambil seluruh `storage_path` dari tabel `public.attachments` yang terkait dengan `inbox_id` kedaluwarsa tersebut.
- Hapus file fisik dari bucket `email-attachments` menggunakan `supabaseAdmin.storage.from('email-attachments').remove(paths)`.
- Hapus seluruh *inbox* kedaluwarsa dari `public.inboxes`.
- Selain Vercel Cron, sertakan juga skrip SQL `pg_cron` di `supabase/` sebagai cadangan otomatis setiap 5 menit.

---

## 7. Spesifikasi Antarmuka Pengguna (`web/src/components/`)

1. **Panel Kontrol Email (`EmailControlPanel.tsx`)**:
   - Menampilkan alamat email aktif dengan ukuran font jelas, tombol **Salin Email** sekali klik (memunculkan *Toast* *"Alamat email berhasil disalin!"*), dan tombol **Hapus & Buat Baru**.
   - Form *accordion/collapsible* atau *inline bar* untuk **Custom Email**:
     - Input `username` dengan indikator validasi *real-time* (memberi peringatan merah jika mengetik `admin`, `support`, `root`, dll.).
     - Dropdown pemilih domain yang memuat semua domain aktif + opsi paling atas **"🎲 Random Domain"**.
     - Tombol **Buat Email Acak** dan tombol **Terapkan Custom Email**.
2. **Timer Hitung Mundur 30 Menit (`ExpiryCountdown.tsx`)**:
   - Menampilkan sisa waktu aktif dalam format `MM:SS` disertai *progress bar* yang berubah warna dari Emerald → Amber → Rose saat mendekati 00:00.
   - Ketika waktu habis, otomatis memicu penghapusan sesi lama dan menawarkan pembuatan *inbox* baru.
3. **Daftar Inbox Real-Time (`InboxSidebar.tsx`)**:
   - Indikator status di bagian atas: titik hijau berdenyut **"Radar Aktif — Menunggu email masuk..."**.
   - Saat email baru masuk dari WebSocket Supabase Realtime:
     - Mainkan suara notifikasi (`useNotificationSound.ts` menggunakan *Web Audio API* dual-tone chime).
     - Munculkan item email di daftar paling atas dengan animasi *slide-down & fade-in* yang mulus.
   - Setiap kartu email menampilkan:
     - Titik biru/hijau jika status masih **Unread** (`!is_read`), dan gaya teks lebih redup jika sudah **Read** (`is_read`).
     - Nama/alamat pengirim, subjek, ikon klip kertas jika ada lampiran, tombol **Salin OTP** (jika ada kode OTP), dan waktu dinamis yang diperbarui setiap 15 detik (*"Baru saja"*, *"2 menit lalu"*).
4. **Pembaca Email & Lampiran (`EmailReader.tsx`)**:
   - Header pesan: Subjek, Pengirim, Penerima, Waktu lengkap, dan tombol Hapus Email.
   - Daftar Lampiran: Menampilkan kartu file (nama file, ukuran KB/MB, tipe MIME) dengan tombol **Unduh Aman (Signed URL)**.
   - Isi Email:
     - Render di dalam `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={sanitizedHtmlWithResolvedCid} />` dengan tinggi otomatis menyesuaikan konten (`auto-resize`).
     - Tersedia tombol *switch* ke tampilan **Plain Text** jika pengguna ingin melihat teks mentah.

---

## 8. Urutan Eksekusi untuk OpenCode (Step-by-Step Build Plan)

Instruksi untuk OpenCode Agent: Kerjakan seluruh proyek ini secara berurutan tanpa melewati satu file pun:
1. **Tahap 1 — Database & Storage SQL:** Buat seluruh file SQL di folder `supabase/` (`01_schema_and_storage.sql`, `02_rls_policies.sql`, `03_seed_domains.sql`).
2. **Tahap 2 — Cloudflare Email Worker:** Buat seluruh kode di `cloudflare-worker/` lengkap dengan `postal-mime`, pengecekan *inbox* aktif, *uploader* ke Supabase Storage bucket `email-attachments`, dan pencatatan `content_id` (CID).
3. **Tahap 3 — Security & Utility Libraries Next.js:** Inisialisasi `web/` dan bangun `usernameValidator.ts` (dengan *blocklist* `admin`, `support`, `root`, `contact`, dll.), `rateLimit.ts`, `sanitizeEmailHtml.ts` (DOMPurify + target blank + CID replacer), serta klien Supabase.
4. **Tahap 4 — Next.js API Routes & Cron Cleanup:** Bangun seluruh *endpoint* di `src/app/api/` (`/api/domains`, `/api/inbox`, `/api/inbox/emails`, `/api/emails/[id]`, dan `/api/cron/cleanup`) beserta `vercel.json`.
5. **Tahap 5 — Frontend Hooks, Audio & UI Modern:** Bangun `useNotificationSound.ts`, `useInboxSession.ts`, dan seluruh komponen UI di `src/components/`, lalu rangkai di `src/app/page.tsx`.
6. **Tahap 6 — Validasi Akhir:** Pastikan `npm run build` di folder `web/` dan pengecekan TypeScript di `cloudflare-worker/` berjalan sukses tanpa *error*, lalu buat `README.md` panduan *deployment*.