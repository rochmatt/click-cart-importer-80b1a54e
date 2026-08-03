// Membuat atau memperbarui satu akun admin di PostgreSQL lokal.
//
// Diperlukan karena setelah cutover tidak ada satu pun pengguna: tanpa akun
// admin yang dibuat lebih dulu, panel admin tidak bisa dimasuki siapa pun dan
// tidak ada jalan untuk memberi peran kepada orang pertama.
//
// Cara pakai — password lewat environment, JANGAN sebagai argumen:
//
//   cd /www/repo/inipilihanku
//   ADMIN_EMAIL=admin@contoh.com ADMIN_PASSWORD='rahasia' \
//     bun run --env-file=.env.server.local db/buat-admin.ts
//
// Argumen baris perintah terlihat di daftar proses seluruh pengguna server
// (ps aux) dan tersimpan di riwayat shell; environment variable tidak.
//
// Aman dijalankan berulang: akun yang sudah ada akan diganti passwordnya dan
// dipastikan berperan admin.

import { hashPassword } from "@/lib/auth/password.server";
import { closePools, run } from "@/lib/db/pool.server";

const OWNER = { rls: false } as const;

const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!email || !email.includes("@")) {
  console.error("ADMIN_EMAIL wajib diisi dan harus berupa alamat email.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("ADMIN_PASSWORD wajib diisi, minimal 8 karakter.");
  process.exit(1);
}

const hash = await hashPassword(password);

// ON CONFLICT sengaja TIDAK dipakai: indeks uniknya ada di lower(email), bukan
// pada kolom email, sehingga ON CONFLICT (email) ditolak PostgreSQL dengan
// 42P10. Cek-lalu-tulis lebih terbaca, dan skrip ini dijalankan manual oleh
// satu orang sehingga balapan bukan persoalan.
//
// Email langsung ditandai terverifikasi. Akun ini dibuat oleh pemilik server
// yang sudah menguasai domainnya; memaksanya melewati tautan email hanya
// menambah langkah tanpa menambah jaminan apa pun.
const [ada] = await run<{ id: string }>(
  "SELECT id FROM auth.users WHERE lower(email) = lower($1)",
  [email],
  OWNER,
);

let userId: string;
const baru = !ada;

if (ada) {
  userId = ada.id;
  await run(
    `UPDATE auth.users
        SET encrypted_password = $2,
            email_confirmed_at = coalesce(email_confirmed_at, now()),
            updated_at = now()
      WHERE id = $1`,
    [userId, hash],
    OWNER,
  );
} else {
  const [dibuat] = await run<{ id: string }>(
    `INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
     VALUES ($1, $2, now()) RETURNING id`,
    [email, hash],
    OWNER,
  );
  userId = dibuat.id;
}

await run("INSERT INTO public.profiles (id) VALUES ($1) ON CONFLICT DO NOTHING", [userId], OWNER);
await run(
  "INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING",
  [userId],
  OWNER,
);

// Sesi lama dicabut: kalau skrip ini dipakai untuk memulihkan akses karena
// password bocor, sesi penyerang harus ikut mati.
const dicabut = await run<{ count: string }>(
  "WITH d AS (DELETE FROM auth.sessions WHERE user_id = $1 RETURNING 1) SELECT count(*) FROM d",
  [userId],
  OWNER,
);

console.log(`  ${baru ? "Akun dibuat" : "Akun diperbarui"}: ${email}`);
console.log(`  id           : ${userId}`);
console.log(`  peran        : admin`);
console.log(`  sesi dicabut : ${dicabut[0]?.count ?? 0}`);

await closePools();
