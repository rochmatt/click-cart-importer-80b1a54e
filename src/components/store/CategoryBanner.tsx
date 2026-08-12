/**
 * Banner header di atas Discover Feed beranda — gambar latar + judul + deskripsi.
 * Dari desain mock Antigravity (.cat-banner). Data app statis, jadi teks tetap
 * "Semua Produk"; scrim gradien (warna latar tema) menjaga teks tetap terbaca di
 * mode terang & gelap apa pun gambarnya. Judul memakai <h2> agar tidak menabrak
 * <h1> semantik halaman yang sudah ada (sr-only) di beranda.
 */
export function CategoryBanner() {
  return (
    <div className="mx-auto max-w-7xl px-3 pt-5 sm:px-6 lg:px-8">
      <div className="relative min-h-[176px] overflow-hidden rounded-2xl border border-border shadow-sm sm:min-h-[200px]">
        <img
          src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1200"
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
        <div className="relative flex min-h-[176px] flex-col justify-center gap-2 p-6 sm:min-h-[200px] sm:p-8">
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Semua Produk
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Jelajahi koleksi lengkap kami. Temukan berbagai penawaran menarik dan produk unggulan
            yang dirancang khusus untuk memenuhi kebutuhan Anda sehari-hari.
          </p>
        </div>
      </div>
    </div>
  );
}
