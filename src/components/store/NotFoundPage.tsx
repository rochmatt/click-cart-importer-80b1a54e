import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Compass, Search } from "lucide-react";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categoryCatalog } from "@/data/categories";

// Halaman 404 bersama untuk seluruh rute.
//
// Versi sebelumnya — tiga salinan terpisah di __root, products.$id, dan
// category.$slug — hanya satu div di tengah layar berisi angka 404 dan tombol
// "Go home". Tidak ada header, tidak ada pencarian, tidak ada jalan lain.
// Pengunjung yang salah mengetik slug hanya punya dua pilihan: kembali ke
// beranda dan mengulang dari nol, atau menutup tab. Yang kedua lebih sering.
//
// Disatukan jadi satu komponen supaya ketiganya tidak perlahan berbeda, dengan
// judul dan pesan yang bisa disesuaikan per konteks.

interface Props {
  /** Judul singkat, mis. "Produk tidak ditemukan". */
  judul?: string;
  pesan?: string;
}

/** Enam kategori teratas — cukup untuk memberi arah tanpa jadi daftar panjang. */
const KATEGORI_POPULER = categoryCatalog.slice(0, 6);

export function NotFoundPage({
  judul = "Halaman tidak ditemukan",
  pesan = "Tautannya mungkin salah ketik, atau halamannya sudah dipindahkan.",
}: Props) {
  const navigate = useNavigate();
  const [kata, setKata] = useState("");

  function cari(e: React.FormEvent) {
    e.preventDefault();
    const q = kata.trim();
    // Pencarian kosong diarahkan ke beranda, bukan ke hasil kosong yang
    // membuat pengunjung merasa gagal untuk kedua kalinya.
    if (!q) return void navigate({ to: "/" });
    void navigate({ to: "/search", search: { q } });
  }

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <div className="hidden md:block">
        <AnnouncementBar />
        <Header query="" onQueryChange={() => {}} />
      </div>

      <main className="mx-auto w-full max-w-3xl px-4 py-12 md:py-16">
        <div className="text-center">
          <p className="text-7xl font-extrabold tracking-tight text-primary/25 sm:text-8xl">404</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {judul}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{pesan}</p>
        </div>

        {/* Pencarian ditaruh paling atas: pengunjung yang tersesat hampir selalu
            sedang mencari sesuatu yang spesifik, bukan ingin menjelajah. */}
        <form onSubmit={cari} className="mx-auto mt-8 flex max-w-lg gap-2" role="search">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={kata}
              onChange={(e) => setKata(e.target.value)}
              placeholder="Cari produk…"
              aria-label="Cari produk"
              className="pl-9"
            />
          </div>
          <Button type="submit">Cari</Button>
        </form>

        <section className="mt-10" aria-labelledby="kategori-populer">
          <h2
            id="kategori-populer"
            className="flex items-center justify-center gap-2 text-sm font-semibold text-foreground"
          >
            <Compass className="h-4 w-4 text-primary" aria-hidden="true" />
            Atau mulai dari kategori populer
          </h2>

          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {KATEGORI_POPULER.map((k) => (
              <li key={k.slug}>
                <Link
                  to="/category/$slug"
                  params={{ slug: k.slug }}
                  className="flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  <span className="text-sm font-semibold text-foreground">{k.label}</span>
                  <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{k.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-10 text-center">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kembali ke beranda
          </Link>
        </div>
      </main>

      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
}
