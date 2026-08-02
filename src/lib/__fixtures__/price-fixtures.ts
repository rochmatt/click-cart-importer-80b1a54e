/**
 * Fixtures for price/discount/range normalization.
 * Real-world shapes taken from Shopee / Tokopedia / TikTok Shop product pages,
 * plus the messy edge cases we have hit while scraping.
 *
 * Keep these as the single source of truth for the parser's contract so the
 * behaviour stays consistent between the server scraper and the admin Grab UI.
 */

import { MAX_PRICE, MIN_PRICE, type PriceIssueCode } from "../price-normalize";

export type ParseFixture = {
  name: string;
  input: unknown;
  expected: number | null;
};

/** Single-value parsing: currency prefixes, separators, suffixes, junk. */
export const PARSE_FIXTURES: ParseFixture[] = [
  // — plain numbers —
  { name: "angka polos", input: "99000", expected: 99_000 },
  { name: "number murni", input: 125_000, expected: 125_000 },
  { name: "number desimal dibulatkan", input: 99_999.6, expected: 100_000 },
  { name: "number nol", input: 0, expected: null },
  { name: "number negatif", input: -5000, expected: null },
  { name: "number NaN", input: Number.NaN, expected: null },
  { name: "number Infinity", input: Number.POSITIVE_INFINITY, expected: null },

  // — currency prefixes / suffixes —
  { name: "prefix Rp tanpa spasi", input: "Rp1.250.000", expected: 1_250_000 },
  { name: "prefix Rp dengan spasi", input: "Rp 1.250.000", expected: 1_250_000 },
  { name: "prefix IDR", input: "IDR 99000", expected: 99_000 },
  { name: "suffix rupiah", input: "250.000 rupiah", expected: 250_000 },
  { name: "non-breaking space", input: "Rp\u00a075.000", expected: 75_000 },
  { name: "spasi berlebih", input: "   Rp  45.000   ", expected: 45_000 },

  // — thousand separators —
  { name: "titik ribuan", input: "1.250.000", expected: 1_250_000 },
  { name: "koma ribuan (en)", input: "1,250,000", expected: 1_250_000 },
  { name: "spasi ribuan", input: "1 250 000", expected: 1_250_000 },
  { name: "ribuan tunggal", input: "10.000", expected: 10_000 },

  // — decimals —
  { name: "desimal koma 2 digit", input: "1.250.000,50", expected: 1_250_001 },
  { name: "desimal titik 2 digit", input: "99,999.99", expected: 100_000 },
  { name: "desimal 1 digit", input: "15.000,5", expected: 15_001 },

  // — shorthand suffixes —
  { name: "rb", input: "150rb", expected: 150_000 },
  { name: "ribu dengan spasi", input: "150 ribu", expected: 150_000 },
  { name: "k", input: "85k", expected: 85_000 },
  { name: "jt koma", input: "1,2jt", expected: 1_200_000 },
  { name: "juta dengan spasi", input: "2 juta", expected: 2_000_000 },
  { name: "jt titik", input: "1.5 jt", expected: 1_500_000 },

  // — ranges: always take the lowest bound —
  { name: "rentang tanda minus", input: "Rp10.000 - Rp25.000", expected: 10_000 },
  { name: "rentang en dash", input: "Rp10.000–Rp25.000", expected: 10_000 },
  { name: "rentang em dash", input: "10.000 — 25.000", expected: 10_000 },
  { name: "rentang s/d", input: "Rp120.000 s/d Rp180.000", expected: 120_000 },
  { name: "rentang sampai", input: "50.000 sampai 90.000", expected: 50_000 },
  { name: "rentang to", input: "199000 to 249000", expected: 199_000 },
  { name: "rentang suffix rb", input: "10rb–25rb", expected: 10_000 },
  { name: "rentang terbalik tetap ambil awal", input: "Rp90.000 - Rp30.000", expected: 90_000 },

  // — unparsable / empty —
  { name: "kata tanpa angka", input: "gratis", expected: null },
  { name: "string kosong", input: "", expected: null },
  { name: "hanya spasi", input: "   ", expected: null },
  { name: "hanya simbol", input: "Rp-", expected: null },
  { name: "null", input: null, expected: null },
  { name: "undefined", input: undefined, expected: null },
  { name: "objek", input: { price: 1000 }, expected: null },
  { name: "array", input: [1000], expected: null },
  { name: "boolean", input: true, expected: null },
];

export type PairFixture = {
  name: string;
  price: unknown;
  salePrice: unknown;
  expected: {
    price: number | null;
    salePrice: number | null;
    discountPercent: number | null;
    /** Issue codes expected, order-independent. */
    codes: PriceIssueCode[];
  };
};

/** Pair normalization: swaps, identical values, discount sanity, ranges, bounds. */
export const PAIR_FIXTURES: PairFixture[] = [
  {
    name: "pasangan normal 25%",
    price: 200_000,
    salePrice: 150_000,
    expected: { price: 200_000, salePrice: 150_000, discountPercent: 25, codes: [] },
  },
  {
    name: "hanya harga normal",
    price: "Rp350.000",
    salePrice: null,
    expected: { price: 350_000, salePrice: null, discountPercent: null, codes: [] },
  },
  {
    name: "diskon tertukar → ditukar otomatis",
    price: 100_000,
    salePrice: 250_000,
    expected: { price: 250_000, salePrice: 100_000, discountPercent: 60, codes: ["swapped"] },
  },
  {
    name: "kedua nilai identik → diskon dikosongkan",
    price: 100_000,
    salePrice: 100_000,
    expected: { price: 100_000, salePrice: null, discountPercent: null, codes: ["identical"] },
  },
  {
    name: "hanya harga diskon → dipakai sebagai harga normal",
    price: null,
    salePrice: 175_000,
    expected: { price: 175_000, salePrice: null, discountPercent: null, codes: ["sale_as_price"] },
  },
  {
    name: "selisih di bawah 1% → diskon dibuang",
    price: 1_000_000,
    salePrice: 999_000,
    expected: {
      price: 1_000_000,
      salePrice: null,
      discountPercent: null,
      codes: ["discount_too_small"],
    },
  },
  {
    name: "diskon di atas 95% → tetap dipakai + peringatan",
    price: 1_000_000,
    salePrice: 20_000,
    expected: {
      price: 1_000_000,
      salePrice: 20_000,
      discountPercent: 98,
      codes: ["discount_too_large"],
    },
  },
  {
    name: "harga normal berupa rentang",
    price: "Rp10.000 - Rp25.000",
    salePrice: null,
    expected: {
      price: 10_000,
      salePrice: null,
      discountPercent: null,
      codes: ["range_collapsed"],
    },
  },
  {
    name: "kedua nilai berupa rentang → dua peringatan rentang",
    price: "Rp200.000 - Rp300.000",
    salePrice: "Rp150.000 - Rp180.000",
    expected: {
      price: 200_000,
      salePrice: 150_000,
      discountPercent: 25,
      codes: ["range_collapsed", "range_collapsed"],
    },
  },
  {
    name: "rentang membuat kedua nilai sama",
    price: "Rp150.000 - Rp300.000",
    salePrice: "Rp150.000 - Rp180.000",
    expected: {
      price: 150_000,
      salePrice: null,
      discountPercent: null,
      codes: ["range_collapsed", "range_collapsed", "identical"],
    },
  },
  {
    name: "rentang diskon lebih tinggi → rentang + tertukar",
    price: "Rp100.000 - Rp120.000",
    salePrice: "Rp250.000 - Rp400.000",
    expected: {
      price: 250_000,
      salePrice: 100_000,
      discountPercent: 60,
      codes: ["range_collapsed", "range_collapsed", "swapped"],
    },
  },
  {
    name: "harga di bawah batas minimum",
    price: 50,
    salePrice: null,
    expected: { price: null, salePrice: null, discountPercent: null, codes: ["too_low"] },
  },
  {
    name: "harga di atas batas maksimum",
    price: MAX_PRICE + 1,
    salePrice: null,
    expected: { price: null, salePrice: null, discountPercent: null, codes: ["too_high"] },
  },
  {
    name: "batas minimum tepat diterima",
    price: MIN_PRICE,
    salePrice: null,
    expected: { price: MIN_PRICE, salePrice: null, discountPercent: null, codes: [] },
  },
  {
    name: "batas maksimum tepat diterima",
    price: MAX_PRICE,
    salePrice: null,
    expected: { price: MAX_PRICE, salePrice: null, discountPercent: null, codes: [] },
  },
  {
    name: "diskon tak wajar kecil → hanya harga normal",
    price: 500_000,
    salePrice: 10,
    expected: { price: 500_000, salePrice: null, discountPercent: null, codes: ["too_low"] },
  },
  {
    name: "harga normal tak terbaca, diskon valid",
    price: "harga spesial",
    salePrice: "Rp249.000",
    expected: {
      price: 249_000,
      salePrice: null,
      discountPercent: null,
      codes: ["unparsable", "sale_as_price"],
    },
  },
  {
    name: "keduanya tak terbaca",
    price: "cek keranjang",
    salePrice: "diskon spesial",
    expected: {
      price: null,
      salePrice: null,
      discountPercent: null,
      codes: ["unparsable", "unparsable"],
    },
  },
  {
    name: "kosong keduanya → tanpa issue",
    price: null,
    salePrice: null,
    expected: { price: null, salePrice: null, discountPercent: null, codes: [] },
  },
  {
    name: "string kosong tidak dianggap error",
    price: "",
    salePrice: "",
    expected: { price: null, salePrice: null, discountPercent: null, codes: [] },
  },
  {
    name: "format shorthand campuran",
    price: "1,2jt",
    salePrice: "899rb",
    expected: { price: 1_200_000, salePrice: 899_000, discountPercent: 25, codes: [] },
  },
  {
    name: "pembulatan desimal",
    price: "1.000.000,49",
    salePrice: "750.000,51",
    expected: { price: 1_000_000, salePrice: 750_001, discountPercent: 25, codes: [] },
  },
];
