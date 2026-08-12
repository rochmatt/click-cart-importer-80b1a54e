// Ringkasan naratif filter aktif untuk dibacakan screen reader.
//
// Dipisah dari komponen agar teksnya bisa diuji tuntas. Region pembacanya
// (role="status" aria-live) hidup di rute; di sini murni: dari state filter →
// satu kalimat yang menyebutkan filter apa saja yang aktif dan berapa produk
// yang tampil.

const rupiah = (n: number) => `Rp${new Intl.NumberFormat("id-ID").format(n)}`;

export interface FilterAktif {
  /** Kata kunci pencarian efektif; kosong berarti tak ada. */
  pencarian: string;
  /** Batas harga; 0 berarti tak ada. */
  hargaMin: number;
  hargaMax: number;
  /** Rating minimum; 0 berarti tak ada. */
  rating: number;
}

/**
 * Kalimat ringkasan untuk pembaca layar. Contoh:
 *   'Filter aktif: pencarian "lari", harga Rp250.000 hingga Rp750.000,
 *    rating 4 bintang ke atas. Menampilkan 2 produk.'
 * Tanpa filter: 'Tidak ada filter aktif. Menampilkan 3 produk.'
 */
export function ringkasanFilterAktif(f: FilterAktif, jumlahProduk: number): string {
  const bagian: string[] = [];

  const cari = f.pencarian.trim();
  if (cari) bagian.push(`pencarian "${cari}"`);

  if (f.hargaMin > 0 && f.hargaMax > 0) {
    bagian.push(`harga ${rupiah(f.hargaMin)} hingga ${rupiah(f.hargaMax)}`);
  } else if (f.hargaMin > 0) {
    bagian.push(`harga mulai ${rupiah(f.hargaMin)}`);
  } else if (f.hargaMax > 0) {
    bagian.push(`harga hingga ${rupiah(f.hargaMax)}`);
  }

  if (f.rating > 0) bagian.push(`rating ${f.rating} bintang ke atas`);

  const produk = `Menampilkan ${jumlahProduk} produk.`;
  return bagian.length === 0
    ? `Tidak ada filter aktif. ${produk}`
    : `Filter aktif: ${bagian.join(", ")}. ${produk}`;
}
