# Brief untuk AI desainer (Antigravity / Gemini / Figma)

Tempel isi berkas ini sebagai konteks sebelum meminta desain UI untuk
inipilihanku.com. Tujuannya satu: desain yang keluar sudah memakai bahasa yang
sama dengan kode yang ada, sehingga implementasinya menyalin tata letak — bukan
menambal ulang warna, radius, dan komponen satu per satu.

## Stack

- **TanStack Start** (SSR, file-based routing di `src/routes/`)
- React 19 + TypeScript
- **Tailwind CSS v4** — konfigurasi ada DI DALAM CSS (`src/styles.css`), **tidak
  ada `tailwind.config.js`**. Jangan hasilkan berkas itu.
- **shadcn/ui** — 46 komponen sudah terpasang di `src/components/ui/`

## Token warna — pakai nama semantik, JANGAN hex

Tema memakai oklch dan punya mode terang + gelap. Tulis `bg-primary`,
`text-muted-foreground`, `border-border` — bukan `bg-[#0891b2]`. Warna hex akan
terlihat benar di mode terang lalu rusak di mode gelap.

| Token | Kelas Tailwind | Nilai (mode terang) |
|---|---|---|
| Latar halaman | `bg-background` / `text-foreground` | putih / abu sangat gelap |
| Warna utama | `bg-primary` / `text-primary-foreground` | `oklch(0.6 0.13 200)` — biru kehijauan |
| Sekunder | `bg-secondary` / `text-secondary-foreground` | abu sangat terang |
| Redup | `text-muted-foreground` | abu sedang, untuk teks penunjang |
| Aksen | `bg-accent` / `text-accent-foreground` | biru muda lembut |
| Bahaya | `bg-destructive` | merah |
| Garis | `border-border`, `bg-card`, `ring-ring` | — |

Sudut: `--radius: 0.75rem`. Pakai `rounded-lg` / `rounded-md` / `rounded-xl`,
jangan angka lepas.

Huruf: **Inter**. Jangan usulkan font lain tanpa alasan kuat — menambah font
berarti menambah permintaan jaringan di halaman yang sudah dioptimasi.

## Komponen yang SUDAH ADA — pakai ini, jangan bikin ulang

accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button,
calendar, card, carousel, chart, checkbox, collapsible, command, context-menu,
dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label,
menubar, navigation-menu, pagination, popover, progress, radio-group, resizable,
scroll-area, select, separator, sheet, skeleton, slider, sonner, switch, table,
tabs, textarea, toggle, toggle-group, tooltip

Kalau desain butuh tombol, dialog, atau tabel — itu sudah ada. Membuat versi
sendiri membuat tampilan tidak konsisten dan menambah kode yang harus dirawat.

## Yang TIDAK perlu Anda kerjakan

Fokus ke tampilan saja. Bagian ini sudah jalan dan akan saya sambungkan sendiri:

- Pengambilan data (server functions TanStack Start, bukan `fetch('/api/...')`)
- Autentikasi (sesi cookie httpOnly milik sendiri)
- Routing (file-based, `createFileRoute`)
- Unggah gambar, pengiriman email, database

Kalau desain butuh data, cukup tulis contoh datanya sebagai props. Jangan
hasilkan pemanggilan API, akses database, atau state autentikasi.

## Bentuk keluaran yang paling berguna, berurutan

1. **Gambar** (PNG/JPG hasil render) — paling jelas, tanpa perlu dibersihkan
2. **HTML + kelas Tailwind** — bagus, tinggal saya pindahkan ke komponen React
3. **Figma** — bisa saya baca langsung
4. **Deskripsi teks** — bisa, tapi paling banyak menyisakan tebakan

Kalau menghasilkan kode React, anggap saja React biasa. Jangan pakai `next/link`,
`next/image`, atau API khusus Next.js — proyek ini bukan Next.js.

## Halaman yang ada sekarang

Beranda, kategori, detail produk, pencarian, keranjang (drawer), checkout,
wishlist, akun/profil, lacak pesanan, dan panel admin (produk, pesanan,
pelanggan, pengumuman, kategori, analitik, pengaturan).
