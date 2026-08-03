// Hashing dan verifikasi password.
//
// Memakai scrypt bawaan node:crypto, bukan bcrypt atau argon2. Alasannya bukan
// karena scrypt lebih kuat — argon2id umumnya lebih disukai — melainkan karena
// scrypt sudah ada di Node tanpa dependency native tambahan. Menambah paket
// native berarti menambah permukaan rantai pasok dan kerumitan build di server
// ini demi selisih yang tidak menentukan pada skala situs ini. scrypt adalah
// pilihan yang diakui (RFC 7914) dan direkomendasikan OWASP.

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Dibungkus manual, bukan lewat promisify: promisify memilih overload tiga
 * argumen sehingga parameter biaya (N, r, p, maxmem) tidak bisa dilewatkan —
 * dan tanpa itu scrypt memakai default yang jauh lebih lemah.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

// N=2^15 mengikuti anjuran OWASP untuk scrypt (N=32768, r=8, p=1). Nilainya
// ikut disimpan di dalam hash supaya bisa dinaikkan kelak tanpa membuat
// password lama gagal diverifikasi.
const N = 32768;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

// scrypt butuh memori kira-kira 128 * N * r byte = 32 MB pada parameter di
// atas. Default maxmem Node adalah 32 MB dan akan menolak, jadi dinaikkan.
const MAX_MEM = 64 * 1024 * 1024;

/** Format: scrypt$N$r$p$salt_base64$hash_base64 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEM,
  });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

/**
 * Mengembalikan false untuk hash cacat, bukan melempar.
 *
 * Alasannya: pemanggilnya adalah alur login. Melempar akan membedakan "hash
 * rusak" dari "password salah" lewat pesan error atau kode status, dan itu
 * memberi penyerang informasi tentang keadaan akun.
 */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  // Batas atas mencegah hash berisi parameter raksasa dipakai sebagai
  // serangan penghabisan memori lewat satu percobaan login.
  if (n > 1 << 20 || r > 32 || p > 16) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = await scryptAsync(password, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: MAX_MEM,
    });
  } catch {
    return false;
  }

  // timingSafeEqual melempar kalau panjang berbeda; panjangnya sudah disamakan
  // lewat argumen keylen di atas, tapi tetap dijaga.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/**
 * Menandakan hash lama yang perlu di-rehash saat login berikutnya, kalau
 * parameter biaya dinaikkan di kemudian hari.
 */
export function needsRehash(stored: string | null): boolean {
  if (!stored) return true;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return true;
  return Number(parts[1]) < N || Number(parts[2]) < R || Number(parts[3]) < P;
}
