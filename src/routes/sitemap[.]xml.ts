import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { categoryCatalog } from "@/data/categories";

// Sitemap XML.
//
// APA YANG SALAH SEBELUMNYA: berkas ini adalah stub bawaan template dengan
// `const BASE_URL = ""` dan komentar TODO yang tidak pernah dikerjakan, berisi
// satu entri. Keluarannya `<loc>/</loc>` — URL RELATIF. Spesifikasi sitemap
// mewajibkan URL absolut, jadi Google menolak seluruh berkasnya, bukan hanya
// entri itu. Sitemap yang tayang tapi ditolak lebih buruk daripada tidak ada:
// ia terlihat sudah beres.
//
// Kini isinya diturunkan dari data nyata — kategori dari katalog, produk dari
// PostgreSQL — sehingga produk baru ikut terindeks tanpa menyunting berkas ini.

type Frekuensi = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

interface Entri {
  path: string;
  lastmod?: string;
  changefreq?: Frekuensi;
  priority?: string;
}

/** Halaman statis yang layak diindeks. */
const HALAMAN_STATIS: Entri[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/categories", changefreq: "weekly", priority: "0.8" },
  { path: "/about", changefreq: "monthly", priority: "0.5" },
  { path: "/how-it-works", changefreq: "monthly", priority: "0.5" },
  { path: "/faq", changefreq: "monthly", priority: "0.5" },
  { path: "/contact", changefreq: "monthly", priority: "0.4" },
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms-of-service", changefreq: "yearly", priority: "0.3" },
];

// SENGAJA TIDAK DIDAFTARKAN: /search (isinya bergantung query, tidak ada konten
// tetap untuk diindeks), /wishlist, /account, /profile, /checkout, /orders,
// /track, dan seluruh /admin — semuanya milik pengguna atau menuntut sesi.

/**
 * Basis URL absolut.
 *
 * Diambil dari SITE_URL, dengan asal permintaan sebagai cadangan. Tanpa basis
 * yang benar seluruh sitemap tidak sah, jadi memakai host yang sedang melayani
 * permintaan jauh lebih baik daripada menerbitkan URL relatif lagi.
 */
function basis(request: Request): string {
  const dariEnv = process.env.SITE_URL?.trim().replace(/\/$/, "");
  if (dariEnv) return dariEnv;
  const url = new URL(request.url);
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "");
  return `${proto}://${url.host}`;
}

/** XML tidak menerima & < > mentah di dalam teks, termasuk di dalam <loc>. */
function xmlAman(teks: string): string {
  return teks
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface BarisProduk {
  id: string;
  catalog_ref: string | null;
  updated_at: string | null;
}

/**
 * Produk yang boleh diindeks: hanya yang berstatus active.
 *
 * Produk draft dikecualikan — mengundang perayap ke halaman yang belum siap
 * tayang hanya menghasilkan halaman tipis di indeks.
 *
 * id yang dipakai adalah catalog_ref kalau ada, karena itulah id yang muncul di
 * URL etalase (lihat toProduct di src/lib/catalog.ts). Memakai uuid untuk
 * produk yang punya catalog_ref menghasilkan URL yang 404.
 */
async function produkTerbit(): Promise<Entri[]> {
  try {
    const { run } = await import("@/lib/db/pool.server");
    const rows = await run<BarisProduk>(
      `SELECT id, catalog_ref, to_char(updated_at, 'YYYY-MM-DD') AS updated_at
         FROM public.admin_products
        WHERE status = 'active'
        ORDER BY updated_at DESC NULLS LAST`,
      [],
      { rls: false },
    );
    return rows.map((r) => ({
      path: `/products/${r.catalog_ref ?? r.id}`,
      lastmod: r.updated_at ?? undefined,
      changefreq: "weekly" as const,
      priority: "0.7",
    }));
  } catch (error) {
    // Sitemap tanpa produk masih sah dan masih berguna. Menggagalkan seluruh
    // respons karena database sedang bermasalah akan membuat Google mencatat
    // sitemap-nya error, yang lebih lama pulihnya daripada gangguannya sendiri.
    console.error("sitemap: gagal membaca produk", error);
    return [];
  }
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const asal = basis(request);

        const entries: Entri[] = [
          ...HALAMAN_STATIS,
          ...categoryCatalog.map((c) => ({
            path: `/category/${c.slug}`,
            changefreq: "weekly" as const,
            priority: "0.6",
          })),
          ...(await produkTerbit()),
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${xmlAman(asal + e.path)}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
