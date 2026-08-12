import { timingSafeEqual } from "node:crypto";

/**
 * Membandingkan rahasia hook cron tanpa membocorkan lewat waktu eksekusi.
 *
 * GAGAL TERTUTUP: kalau env-nya belum disetel, semua permintaan ditolak.
 * Perbandingan biasa akan menyamakan dua nilai kosong dan membuka endpoint ini
 * ke internet begitu variabelnya lupa dipasang.
 *
 * Panjang yang berbeda dijawab lebih dulu karena timingSafeEqual melempar bila
 * panjang buffer tidak sama. Panjang rahasia bukan info berguna bagi penyerang;
 * isinya yang dilindungi. Rahasia diterima lewat header Authorization: Bearer
 * atau x-hook-secret, sama seperti hook status pesanan.
 */
export function hookSecretMatches(request: Request, envName: string): boolean {
  const diharapkan = process.env[envName];
  if (!diharapkan) {
    console.error(`${envName} belum disetel — hook menolak semua permintaan`);
    return false;
  }
  const diberikan =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    request.headers.get("x-hook-secret") ||
    "";
  const a = Buffer.from(diberikan);
  const b = Buffer.from(diharapkan);
  return a.length === b.length && timingSafeEqual(a, b);
}
