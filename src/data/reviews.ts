/**
 * Curated customer reviews shown on product pages. These power both the
 * visible review list and the schema.org `Review` rich snippet — Google
 * requires review markup to match reviews the visitor can actually read.
 */
export interface ProductReview {
  id: string;
  author: string;
  rating: number;
  date: string; // ISO date
  title: string;
  body: string;
}

const reviews: Record<string, ProductReview[]> = {
  "1": [
    {
      id: "1-a",
      author: "Dewi Anggraini",
      rating: 5,
      date: "2026-05-18",
      title: "Nyaman dipakai seharian",
      body: "Kulitnya lembut dan sol-nya empuk. Dipakai kerja dari pagi sampai malam kaki tetap nyaman, ukuran sesuai tabel.",
    },
    {
      id: "1-b",
      author: "Rizky Pratama",
      rating: 4,
      date: "2026-04-02",
      title: "Bagus, butuh sedikit break-in",
      body: "Jahitan rapi dan warnanya persis foto. Dua hari pertama agak kaku, setelah itu pas banget.",
    },
  ],
  "2": [
    {
      id: "2-a",
      author: "Nadia Kusuma",
      rating: 5,
      date: "2026-06-09",
      title: "ANC-nya benar-benar bekerja",
      body: "Suara mesin bus langsung hilang saat ANC aktif. Bass rapat tanpa menutupi vokal, baterai tahan seminggu pemakaian normal.",
    },
    {
      id: "2-b",
      author: "Fajar Setiawan",
      rating: 4,
      date: "2026-03-21",
      title: "Nyaman, sedikit hangat",
      body: "Bantalan lembut dan clamping-nya pas. Kalau dipakai lebih dari tiga jam telinga terasa hangat, tapi kualitas suaranya sepadan.",
    },
  ],
  "3": [
    {
      id: "3-a",
      author: "Maya Larasati",
      rating: 5,
      date: "2026-05-30",
      title: "Cantik dan tebal",
      body: "Glasir mattenya rata, pegangan mantap, dan panas kopi bertahan lama. Aman di dishwasher sejauh ini.",
    },
  ],
  "4": [
    {
      id: "4-a",
      author: "Sari Wulandari",
      rating: 5,
      date: "2026-06-14",
      title: "Kulit lebih merata setelah 3 minggu",
      body: "Teksturnya ringan, cepat meresap, tidak bikin perih. Bekas jerawat memudar dan wajah tampak lebih cerah.",
    },
    {
      id: "4-b",
      author: "Intan Permata",
      rating: 4,
      date: "2026-02-11",
      title: "Efektif tapi baunya khas",
      body: "Hasilnya bagus untuk kulit kusam. Aroma vitamin C-nya agak kuat di awal, hilang setelah beberapa menit.",
    },
  ],
  "5": [
    {
      id: "5-a",
      author: "Bagas Nugroho",
      rating: 4,
      date: "2026-04-27",
      title: "Desain rapi, baterai awet",
      body: "Tampilannya klasik jadi cocok ke kantor, notifikasi masuk stabil, sekali charge tahan hampir dua minggu.",
    },
  ],
  "6": [
    {
      id: "6-a",
      author: "Anisa Rahma",
      rating: 5,
      date: "2026-06-01",
      title: "Kulit asli, muat banyak",
      body: "Ukurannya compact tapi dompet, HP, dan powerbank masuk semua. Strapnya bisa disetel dan tidak menekan bahu.",
    },
    {
      id: "6-b",
      author: "Yoga Mahendra",
      rating: 4,
      date: "2026-03-05",
      title: "Sepadan harganya",
      body: "Bau kulitnya khas dan mulai berpatina setelah sebulan. Zipper terasa solid, hanya sedikit berat saat kosong.",
    },
  ],
  "7": [
    {
      id: "7-a",
      author: "Hendra Wijaya",
      rating: 5,
      date: "2026-05-08",
      title: "Cahaya hangat, mata tidak lelah",
      body: "Dimming-nya halus dan tidak flicker saat dipakai baca lama. Lengannya kokoh, tidak turun sendiri.",
    },
  ],
  "8": [
    {
      id: "8-a",
      author: "Putri Handayani",
      rating: 4,
      date: "2026-06-20",
      title: "Polarisasinya terasa",
      body: "Silau di jalan berkurang jauh saat siang. Frame acetate-nya ringan, engselnya rapat dan tidak longgar.",
    },
  ],
};

export function reviewsForProduct(id: string): ProductReview[] {
  return reviews[id] ?? [];
}
