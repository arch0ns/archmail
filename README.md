<<<<<<< HEAD
# ANNE TMAIL

**Secure Real-Time Temporary Email** — inbox sementara dengan masa aktif 30 menit, real-time via Supabase Realtime, keamanan berlapis (anti-IDOR, XSS sanitization, sandboxed rendering, rate limit), serta lampiran privat via Signed URL.

📖 **Baru pertama kali? Ikuti panduan langkah-demi-langkah di [`INSTALL.md`](./INSTALL.md).**
README ini adalah ringkasan arsitektur & referensi.

Monorepo terdiri dari 3 bagian:

| Folder | Peran | Deploy |
|---|---|---|
| `supabase/` | PostgreSQL schema, RLS, Storage, pg_cron | Supabase SQL Editor |
| `cloudflare-worker/` | Email Worker catch-all: parse MIME + upload lampiran | Cloudflare Workers + Email Routing |
| `web/` | Next.js App Router: UI + API Routes + Vercel Cron | Vercel |

---

## 1. Prasyarat

- **Node.js 20+** dan npm
- Akun **Supabase** (project baru)
- Akun **Cloudflare** dengan domain yang dikelola di sana
- Akun **Vercel** (untuk hosting web + cron)

---

## 2. Setup Supabase

### 2.1 Jalankan SQL berurutan

Buka **Supabase Dashboard → SQL Editor**, lalu jalankan file berikut **sesuai urutan**:

1. `supabase/01_schema_and_storage.sql` — tabel + private bucket `email-attachments` + RLS enable + Realtime publication + trigger
2. `supabase/02_rls_policies.sql` — policy anti-IDOR berbasis header `x-inbox-token`
3. `supabase/03_seed_domains.sql` — **ganti** domain contoh dengan domain asli kamu
4. `supabase/04_pg_cron.sql` — cadangan auto-purge tiap 5 menit (`pg_cron` harus diaktifkan di **Database → Extensions**)

### 2.2 Ambil kredensial

**Project Settings → API**:

- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**RAHASIA**, jangan pernah bocor ke client)

> ⚠️ `service_role` mem-bypass RLS. Hanya dipakai di server (API Routes & Cloudflare Worker).

### 2.3 Catatan Realtime + RLS

Policy `emails_read_with_valid_token` memverifikasi header `x-inbox-token` pada koneksi Realtime. Client Supabase dikonfigurasi mengirim header tersebut (lihat `web/src/lib/supabaseClient.ts`).

Jika pada project kamu header tidak terbaca oleh Realtime, aplikasi otomatis **fallback ke polling 15 detik** (indikator di Navbar berubah menjadi “Polling”). Data tetap aman karena API route selalu memverifikasi `access_token` di sisi server.

---

## 3. Setup Cloudflare Email Worker

### 3.1 Aktifkan Email Routing

1. Cloudflare Dashboard → domain kamu → **Email → Email Routing** → aktifkan (ini mengatur record MX).
2. Buat **Catch-all rule** → Action: **Send to a Worker** → pilih worker `anne-tmail-worker`.

### 3.2 Konfigurasi & deploy worker

```bash
cd cloudflare-worker
npm install

# Set URL Supabase pada wrangler.toml ([vars] SUPABASE_URL)
# Lalu simpan secret service role:
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

npx wrangler deploy
```

Opsional uji tipe: `npm run typecheck`. Log real-time: `npm run tail`.

### 3.3 Alur pemrosesan email

1. Normalisasi alamat tujuan.
2. Cek inbox aktif (`inboxes` dengan `email_address` + `expires_at > now`). Bila tidak ada → email **diabaikan** (anti-spam).
3. Parse MIME (`postal-mime`) + ekstrak kode OTP.
4. Simpan ke `public.emails` (dapat `email.id`).
5. Upload lampiran (maks **5 file**, masing-masing **< 10 MB**) ke bucket privat, simpan metadata termasuk `content_id` (CID) untuk gambar inline.

---

## 4. Setup Web (Next.js + Vercel)

### 4.1 Jalankan lokal

```bash
cd web
cp .env.example .env.local   # isi kredensial Supabase + CRON_SECRET
npm install
npm run dev                  # http://localhost:3000
```

Build produksi:

```bash
npm run build
npm run start
```

### 4.2 Deploy ke Vercel

1. Import repo, set **Root Directory** = `web`.
2. Tambahkan Environment Variables (Production & Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (mis. `https://anne-tmail.vercel.app`)
   - `CRON_SECRET` (string acak panjang)
3. Deploy. `vercel.json` otomatis mendaftarkan cron `GET /api/cron/cleanup` tiap **5 menit**.

> Vercel Cron mengirim `Authorization: Bearer <CRON_SECRET>` secara otomatis bila env `CRON_SECRET` di-set.
> Uji manual: `curl -H "Authorization: Bearer <CRON_SECRET>" https://<domain>/api/cron/cleanup`

---

## 5. Referensi API

| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| `GET` | `/api/domains` | — | Daftar domain aktif |
| `POST` | `/api/inbox` | — | Buat inbox (rate limit **10/menit/IP**) |
| `DELETE` | `/api/inbox` | Bearer token | Hapus inbox + seluruh lampiran |
| `GET` | `/api/inbox/emails` | Bearer token | Daftar email (rate limit **60/menit/IP**) |
| `GET` | `/api/emails/[id]` | Bearer token | Detail + mark read + Signed URL + sanitasi + CID |
| `PATCH` | `/api/emails/[id]` | Bearer token | Tandai read/unread |
| `DELETE` | `/api/emails/[id]` | Bearer token | Hapus email + lampiran |
| `GET` | `/api/cron/cleanup` | `Bearer CRON_SECRET` | Purge inbox kedaluwarsa + file Storage |

`access_token` dibawa pada header `Authorization: Bearer <accessToken>`.

---

## 6. Fitur Keamanan

- **Anti-IDOR** — kepemilikan inbox hanya via `access_token` 64-char hex (`crypto.randomBytes(32)`); tidak ada policy RLS yang membocorkan token.
- **XSS** — `body_html` disanitasi dengan `isomorphic-dompurify` (buang `script`, `on*`, `javascript:`, `object`, `embed`, `form`).
- **Sandboxed rendering** — `<iframe sandbox="allow-popups allow-popups-to-escape-sandbox">` tanpa `allow-scripts` & tanpa `allow-same-origin`.
- **Safe links** — semua `<a>` dipaksa `target="_blank" rel="noopener noreferrer nofollow"`.
- **Rate limit** — 10 req/menit (buat inbox) & 60 req/menit (baca email) per IP.
- **Lampiran privat** — bucket `email-attachments` (`public = false`), akses hanya via **Signed URL 10 menit**.
- **Blocklist username** — `admin`, `support`, `root`, `contact`, `help`, `security`, `postmaster`, dll., plus prefix `admin-`, `support-`, `root-`, `official-`.

---

## 7. Troubleshooting

| Masalah | Penyebab / Solusi |
|---|---|
| Email tidak masuk | Cek Catch-all rule → Worker; cek MX Email Routing; cek log `wrangler tail`; pastikan inbox belum kedaluwarsa. |
| Navbar menampilkan “Polling” | Header `x-inbox-token` tidak terbaca Realtime. Aplikasi tetap jalan via polling; data tetap aman. |
| Lampiran 403 / blank | Signed URL kedaluwarsa (>10 menit). Buka ulang email untuk URL baru. |
| `domain tidak valid` saat buat inbox | Domain belum ada/aktif di tabel `domains` (jalankan seed yang benar). |
| Cron tidak berjalan | Pastikan `CRON_SECRET` ter-set di Vercel dan `vercel.json` ikut ter-deploy. |
| Data menumpuk | Aktifkan ekstensi `pg_cron` dan jalankan `04_pg_cron.sql`. |

---

## 8. Batasan yang Diketahui

- **Rate limiter in-memory** tidak persisten antar instance serverless. Untuk skala besar, ganti dengan Upstash Redis.
- **Auto-resize iframe** dibatasi sandbox (tanpa `allow-same-origin`), sehingga tinggi konten tidak selalu bisa diukur; iframe punya tinggi default dengan scroll internal.
- **`pg_cron`** hanya menghapus baris DB; file Storage dihapus oleh Vercel Cron / `DELETE /api/inbox`.
- **Custom username** dengan alamat yang sedang aktif ditolak (409) untuk mencegah pembajakan.

---

## 9. Struktur Proyek

```
ArchTempMail/
├── PRD.md
├── README.md
├── INSTALL.md
├── .gitignore
├── supabase/
│   ├── 01_schema_and_storage.sql
│   ├── 02_rls_policies.sql
│   ├── 03_seed_domains.sql
│   └── 04_pg_cron.sql
├── cloudflare-worker/
│   ├── package.json
│   ├── tsconfig.json
│   ├── wrangler.toml
│   └── src/
│       ├── index.ts
│       ├── mimeParser.ts
│       ├── otpExtractor.ts
│       └── types.ts
└── web/
    ├── package.json
    ├── tsconfig.json
    ├── next.config.mjs
    ├── tailwind.config.ts
    ├── postcss.config.mjs
    ├── vercel.json
    ├── .env.example
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── globals.css
        │   ├── page.tsx
        │   └── api/
        │       ├── domains/route.ts
        │       ├── inbox/route.ts
        │       ├── inbox/emails/route.ts
        │       ├── emails/[id]/route.ts
        │       └── cron/cleanup/route.ts
        ├── components/
        │   ├── Navbar.tsx
        │   ├── EmailControlPanel.tsx
        │   ├── ExpiryCountdown.tsx
        │   ├── InboxSidebar.tsx
        │   ├── EmailReader.tsx
        │   └── Toast.tsx
        ├── hooks/
        │   ├── useInboxSession.ts
        │   └── useNotificationSound.ts
        ├── lib/
        │   ├── supabaseAdmin.ts
        │   ├── supabaseClient.ts
        │   ├── inboxAuth.ts
        │   ├── rateLimit.ts
        │   ├── usernameValidator.ts
        │   ├── sanitizeEmailHtml.ts
        │   ├── storageCleanup.ts
        │   └── utils.ts
        └── types/
            └── index.ts
```
=======
# archmail
>>>>>>> ece735db4bcaaad508cb8195957655369de93b32
