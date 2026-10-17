# ANNE TMAIL — Tutorial Instalasi Lengkap (dari Nol)

> Panduan langkah demi langkah untuk menjalankan **ANNE TMAIL** dari nol:
> Supabase (database + storage) → Cloudflare (Email Worker) → Vercel (web).
> Estimasi waktu: **30–45 menit**. Tidak butuh pengalaman serverless sebelumnya.

---

## Daftar Isi

1. [Yang Kamu Butuhkan](#1-yang-kamu-butuhkan)
2. [Setup Lokal (opsional, untuk uji coba)](#2-setup-lokal-opsional)
3. [Setup Supabase](#3-setup-supabase)
4. [Setup Cloudflare Email Worker](#4-setup-cloudflare-email-worker)
5. [Setup Vercel (Web)](#5-setup-vercel-web)
6. [Verifikasi End-to-End](#6-verifikasi-end-to-end)
7. [Troubleshooting](#7-troubleshooting)
8. [Checklist Akhir](#8-checklist-akhir)

---

## 1. Yang Kamu Butuhkan

| Kebutuhan | Catatan |
|---|---|
| Node.js **20+** | Cek: `node -v` |
| npm | Cek: `npm -v` |
| Akun **Supabase** | Gratis — https://supabase.com |
| Akun **Cloudflare** + 1 domain | Domain harus pakai nameserver Cloudflare |
| Akun **Vercel** | Gratis — https://vercel.com |
| Git | Untuk deploy via Vercel |

> **Penting soal domain:** fitur Email Worker hanya jalan pada domain yang
> **nameserver-nya mengarah ke Cloudflare**. Kalau domainmu belum di Cloudflare,
> pindahkan NS-nya dulu (ambil 2 nameserver dari Dashboard Cloudflare).
> Kamu **boleh memakai 1 domain saja** — cukup tambahkan domain itu (dan/atau subdomain) ke tabel `domains`.

---

## 2. Setup Lokal (opsional)

Untuk mencoba sebelum deploy:

```bash
# 1. Masuk ke folder web
cd web

# 2. Salin konfigurasi environment
cp .env.example .env.local        # Windows PowerShell: Copy-Item .env.example .env.local

# 3. Isi .env.local (lihat bagian 3.4 untuk nilai-nilainya)

# 4. Pasang dependency
npm install

# 5. Jalankan dev server
npm run dev
# buka http://localhost:3000
```

Untuk worker di lokal (uji email):

```bash
cd cloudflare-worker
npm install
# isi SUPABASE_URL di wrangler.toml [vars]
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

---

## 3. Setup Supabase

### 3.1 Buat Project

1. Login ke https://supabase.com → **New Project**.
2. Isi **Name**, **Database Password** (simpan!), pilih **Region** terdekat (mis. Singapore).
3. Tunggu ~2 menit sampai project siap.

### 3.2 Jalankan File SQL (URUT, jangan diacak)

Buka **Supabase Dashboard → SQL Editor → New Query**, lalu jalankan **satu per satu**:

#### Langkah 1 — `supabase/01_schema_and_storage.sql`
Membuat:
- tabel `domains`, `inboxes`, `emails`, `attachments`
- index + trigger `created_at`
- bucket privat **`email-attachments`** (limit 10 MB)
- RLS diaktifkan + Realtime publication

Copy seluruh isi file → paste ke SQL Editor → **Run**. Pastikan hasilnya `Success`.

#### Langkah 2 — `supabase/02_rls_policies.sql`
Membuat policy anti-IDOR berbasis header `x-inbox-token`.
Copy → paste → **Run**.

#### Langkah 3 — `supabase/03_seed_domains.sql` (⚠️ WAJIB DIEDIT)
Ganti domain contoh dengan **domain aslimu**:

```sql
INSERT INTO public.domains (domain_name, is_active) VALUES
    ('mail.domainmu.com',  TRUE),
    ('temp.domainmu.com',  TRUE)
ON CONFLICT (domain_name) DO UPDATE
    SET is_active = EXCLUDED.is_active;
```

Copy → paste → **Run**.

> Boleh hanya 1 domain. Boleh juga pakai domain utama (`domainmu.com`).
> Yang penting: domain ini sudah **diarahkan ke Cloudflare** (bagian 4).

#### Langkah 4 — `supabase/04_pg_cron.sql`
Cadangan auto-purge tiap 5 menit.

**Aktifkan ekstensi dulu:** **Database → Extensions** → cari `pg_cron` → **Enable**.
Baru kemudian copy → paste file `04_pg_cron.sql` → **Run**.

> Jika `pg_cron` tidak bisa diaktifkan (paket gratisan tertentu), **lewati langkah ini**.
> Pembersihan tetap jalan lewat Vercel Cron (bagian 5).

### 3.3 Verifikasi Cepat Database

Jalankan di SQL Editor:

```sql
SELECT domain_name, is_active FROM public.domains;
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

- `domains` harus berisi domainmu, `is_active = true`.
- Semua tabel harus `rowsecurity = true`.

Cek bucket: **Storage** → harus ada bucket **`email-attachments`** bertanda **Private**.

### 3.4 Ambil Kredensial

Buka **Project Settings (⚙️) → API**, salin 3 nilai ini:

| Nama di Dashboard | Variabel Environment |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` key | `SUPABASE_SERVICE_ROLE_KEY` |

> 🔐 **`service_role` bersifat RAHASIA.** Jangan pernah commit / taruh di kode client.
> Hanya dipakai di API Routes server & Cloudflare Worker.

### 3.5 (Khusus Realtime) Cek Publikasi

Opsional, cek bahwa tabel sudah masuk publikasi Realtime:

```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

Harus muncul `emails`, `attachments`, `inboxes`.

---

## 4. Setup Cloudflare Email Worker

### 4.1 Install & Login Wrangler

```bash
cd cloudflare-worker
npm install

npx wrangler login     # buka browser, izinkan akses
```

### 4.2 Isi Konfigurasi

Edit `wrangler.toml`, ganti `SUPABASE_URL`:

```toml
[vars]
SUPABASE_URL = "https://PROJECT-ID.supabase.co"
MAX_ATTACHMENTS = "5"
MAX_ATTACHMENT_BYTES = "10485760"
```

Simpan **service role key** sebagai secret (tidak masuk file):

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# tempel service_role key dari Supabase saat diminta
```

### 4.3 Deploy Worker

```bash
npx wrangler deploy
```

Catat nama worker-nya (mis. `anne-tmail-worker`).

### 4.4 Aktifkan Cloudflare Email Routing

1. Cloudflare Dashboard → pilih **domain** → menu **Email** → **Email Routing**.
2. Klik **Enable / Get started** → Cloudflare otomatis menambahkan record **MX** (izinkan).
3. Buka tab **Routes** / **Catch-all rule**:
   - **Catch-all** → **Edit** → **Action: Send to a Worker**
   - Pilih **`anne-tmail-worker`** → **Save**.
4. Pastikan status **Email Routing: Active**.

> Setelah ini, semua email ke `*@domainmu.com` (catch-all) akan dikirim ke worker,
> lalu worker memprosesnya ke Supabase.

### 4.5 Pantau Log (untuk debugging)

```bash
npx wrangler tail
```

Biarkan terminal ini terbuka saat kamu mengirim email uji.

---

## 5. Setup Vercel (Web)

### 5.1 Push ke Git

```bash
# dari root proyek
git init
git add .
git commit -m "ANNE TMAIL initial"
git remote add origin <URL-REPO-KAMU>
git push -u origin main
```

> Pastikan `.env.local` **tidak** ikut ter-commit (sudah ada di `.gitignore`).

### 5.2 Import di Vercel

1. https://vercel.com → **Add New → Project** → import repo kamu.
2. **Penting:** set **Root Directory** = `web`.
3. Framework terdeteksi otomatis: **Next.js**.

### 5.3 Set Environment Variables

Di **Settings → Environment Variables**, tambahkan (untuk **Production** & **Preview**):

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | dari 3.4 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | dari 3.4 |
| `SUPABASE_SERVICE_ROLE_KEY` | dari 3.4 |
| `NEXT_PUBLIC_APP_URL` | `https://nama-app.vercel.app` |
| `CRON_SECRET` | string acak panjang (mis. 40 karakter) |

> Buat `CRON_SECRET` acak, contoh:
> `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`

### 5.4 Deploy

Klik **Deploy**. Setelah selesai:

- `vercel.json` otomatis mendaftarkan cron `GET /api/cron/cleanup` tiap **5 menit**.
- Cek di Vercel: **Settings → Cron Jobs** (harus muncul `/api/cron/cleanup`).

### 5.5 Uji Cron Manual

```bash
curl -X GET "https://nama-app.vercel.app/api/cron/cleanup" \
  -H "Authorization: Bearer <CRON_SECRET_KAMU>"
```

Respons yang benar: `{"success":true,"purgedInboxes":0}`.
Respons `401` = `CRON_SECRET` salah/tidak ter-set.

---

## 6. Verifikasi End-to-End

1. Buka aplikasi di Vercel (`https://nama-app.vercel.app`).
2. Klik **✨ Buat Email Acak** → alamat muncul (mis. `a1b2c3d4e@mail.domainmu.com`).
3. **Salin** alamat tersebut.
4. Kirim email uji dari Gmail/email lain ke alamat itu.
5. Dalam beberapa detik email harus muncul otomatis (animasi + suara 🔔).
6. Buka email → cek:
   - Isi HTML render aman.
   - Tab **Plain Text** berfungsi.
   - Lampiran muncul + bisa diunduh via Signed URL.
   - OTP terdeteksi (jika ada).
7. Biarkan terminal `wrangler tail` terbuka untuk melihat log pemrosesan.

**Hasil yang diharapkan di log worker:**
```
Saved email <uuid> for xxx@mail.domainmu.com with 1/1 attachments
```

---

## 7. Troubleshooting

| Gejala | Kemungkinan Penyebab | Solusi |
|---|---|---|
| Email tidak pernah masuk | Catch-all belum ke Worker | Ulangi **4.4**, pastikan pilih worker `anne-tmail-worker` |
| Email tidak masuk | MX belum propagasi | Tunggu 5–30 menit, cek di Cloudflare Email Routing = **Active** |
| Email tidak masuk | Inbox sudah kedaluwarsa (>30 mnt) | Buat inbox baru, kirim ulang |
| Log worker: `No active inbox` | Domain di email beda dengan `domains` | Tambah domain yang benar di **3.2 langkah 3** |
| Log worker: `insertEmail failed` | Secret salah | `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` ulang |
| Navbar menampilkan **“Polling”** | Header realtime tidak terbaca | Normal — app fallback polling 15 detik, data tetap aman |
| Error `domain tidak valid` saat buat inbox | Domain belum ada/aktif | Cek `SELECT * FROM domains;` + `is_active = true` |
| Lampiran blank / 403 | Signed URL kadaluwarsa (>10 mnt) | Buka ulang email → URL baru dibuat |
| Cron cron tidak jalan | `CRON_SECRET` belum set / `vercel.json` belum ter-deploy | Set env, redeploy |
| Build Vercel gagal `Cannot find module` | Root Directory salah | Set **Root Directory = `web`** |
| Data menumpuk | `pg_cron` nonaktif | Aktifkan ekstensi + jalankan `04_pg_cron.sql` |

---

## 8. Checklist Akhir

- [ ] Node.js 20+ & npm terpasang
- [ ] Supabase project dibuat
- [ ] `01_schema_and_storage.sql` dijalankan
- [ ] `02_rls_policies.sql` dijalankan
- [ ] `03_seed_domains.sql` dijalankan **dengan domain asli**
- [ ] `04_pg_cron.sql` dijalankan (jika `pg_cron` diaktifkan)
- [ ] Bucket `email-attachments` ada & **Private**
- [ ] `SUPABASE_URL` diset di `wrangler.toml`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` diset sebagai wrangler secret
- [ ] Worker berhasil `wrangler deploy`
- [ ] Cloudflare **Email Routing → Catch-all → Worker** aktif
- [ ] Repo di-push ke Git, Vercel import dengan **Root Directory = `web`**
- [ ] 5 environment variables di Vercel terisi
- [ ] Vercel deploy sukses
- [ ] Cron `/api/cron/cleanup` terdaftar
- [ ] Uji kirim email → muncul real-time ✅

---

## Lampiran — Ringkasan Perintah

```bash
# ---- WEB (lokal) ----
cd web
cp .env.example .env.local
npm install
npm run dev

# ---- WEB (build produksi) ----
npm run build && npm run start

# ---- WORKER ----
cd cloudflare-worker
npm install
npx wrangler login
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler deploy
npx wrangler tail          # log real-time

# ---- Uji Cron ----
curl -H "Authorization: Bearer <CRON_SECRET>" \
  https://nama-app.vercel.app/api/cron/cleanup
```

---

**Catatan akhir:** setelah selesai, jangan pernah membagikan `SUPABASE_SERVICE_ROLE_KEY`
atau `CRON_SECRET`. Jika bocor, segera rotate di Supabase (**Settings → API → Reset**)
dan ubah env di Vercel + secret ulang di Wrangler.