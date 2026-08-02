import { describe, it, expect } from "vitest";
import {
  parsePriceValue,
  normalizePrices,
  PRICE_ISSUE_LABELS,
  MAX_PRICE,
  MIN_PRICE,
  type PriceIssueCode,
} from "./price-normalize";
import { PRICE_RULES } from "./price-normalize";
import { PARSE_FIXTURES, PAIR_FIXTURES } from "./__fixtures__/price-fixtures";

function codesOf(issues: { code: PriceIssueCode }[]): PriceIssueCode[] {
  return issues.map((i) => i.code).sort();
}

describe("parsePriceValue", () => {
  it.each(PARSE_FIXTURES.map((f) => [f.name, f.input, f.expected] as const))(
    "%s",
    (_name, input, expected) => {
      expect(parsePriceValue(input)).toBe(expected);
    },
  );

  it("selalu mengembalikan integer positif atau null", () => {
    for (const fixture of PARSE_FIXTURES) {
      const result = parsePriceValue(fixture.input);
      if (result !== null) {
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThan(0);
      }
    }
  });

  it("idempoten: hasil parse yang di-parse lagi tidak berubah", () => {
    for (const fixture of PARSE_FIXTURES) {
      const once = parsePriceValue(fixture.input);
      if (once !== null) expect(parsePriceValue(once)).toBe(once);
    }
  });

  it("rentang selalu memakai angka pertama, bukan yang terbesar", () => {
    expect(parsePriceValue("Rp10.000 - Rp25.000")).toBe(10_000);
    expect(parsePriceValue("Rp25.000 - Rp10.000")).toBe(25_000);
  });
});

describe("normalizePrices", () => {
  it.each(PAIR_FIXTURES.map((f) => [f.name, f] as const))("%s", (_name, fixture) => {
    const result = normalizePrices(fixture.price, fixture.salePrice);
    expect(result.price).toBe(fixture.expected.price);
    expect(result.salePrice).toBe(fixture.expected.salePrice);
    expect(result.discountPercent).toBe(fixture.expected.discountPercent);
    expect(codesOf(result.issues)).toEqual([...fixture.expected.codes].sort());
  });

  it("menjaga invariant: harga diskon selalu < harga normal", () => {
    for (const fixture of PAIR_FIXTURES) {
      const { price, salePrice } = normalizePrices(fixture.price, fixture.salePrice);
      if (price !== null && salePrice !== null) expect(salePrice).toBeLessThan(price);
    }
  });

  it("menjaga invariant: diskon hanya ada bila kedua harga ada", () => {
    for (const fixture of PAIR_FIXTURES) {
      const { price, salePrice, discountPercent } = normalizePrices(
        fixture.price,
        fixture.salePrice,
      );
      if (discountPercent === null) continue;
      expect(price).not.toBeNull();
      expect(salePrice).not.toBeNull();
      expect(discountPercent).toBeGreaterThanOrEqual(1);
      expect(discountPercent).toBeLessThanOrEqual(100);
      expect(discountPercent).toBe(Math.round(((price! - salePrice!) / price!) * 100));
    }
  });

  it("menjaga invariant: nilai yang lolos selalu dalam batas wajar", () => {
    for (const fixture of PAIR_FIXTURES) {
      const { price, salePrice } = normalizePrices(fixture.price, fixture.salePrice);
      for (const value of [price, salePrice]) {
        if (value === null) continue;
        expect(value).toBeGreaterThanOrEqual(MIN_PRICE);
        expect(value).toBeLessThanOrEqual(MAX_PRICE);
      }
    }
  });

  it("setiap issue punya label, field, dan penjelasan yang terisi", () => {
    for (const fixture of PAIR_FIXTURES) {
      const { issues } = normalizePrices(fixture.price, fixture.salePrice);
      for (const issue of issues) {
        expect(PRICE_ISSUE_LABELS[issue.code]).toBeTruthy();
        expect(issue.title).toBe(PRICE_ISSUE_LABELS[issue.code]);
        expect(["price", "salePrice", "both"]).toContain(issue.field);
        expect(["warning", "error"]).toContain(issue.level);
        expect(issue.detail.length).toBeGreaterThan(10);
        expect(issue.action.length).toBeGreaterThan(5);
      }
    }
  });

  it("issue level error berarti nilai terkait tidak diterapkan", () => {
    const tooLow = normalizePrices(50, null);
    expect(tooLow.issues.some((i) => i.level === "error" && i.code === "too_low")).toBe(true);
    expect(tooLow.price).toBeNull();

    const tooHigh = normalizePrices(MAX_PRICE + 1_000, null);
    expect(tooHigh.issues.some((i) => i.level === "error" && i.code === "too_high")).toBe(true);
    expect(tooHigh.price).toBeNull();

    const unparsable = normalizePrices("hubungi penjual", null);
    expect(unparsable.issues.some((i) => i.level === "error" && i.code === "unparsable")).toBe(true);
    expect(unparsable.price).toBeNull();
  });

  it("issue rentang menyebut nilai terendah yang dipakai", () => {
    const { issues } = normalizePrices("Rp10.000 - Rp25.000", null);
    const range = issues.find((i) => i.code === "range_collapsed");
    expect(range?.level).toBe("warning");
    expect(range?.action).toContain("10.000");
  });

  it("issue tertukar menyebut kedua nilai sebelum dan sesudah", () => {
    const { issues } = normalizePrices(100_000, 250_000);
    const swapped = issues.find((i) => i.code === "swapped");
    expect(swapped?.field).toBe("both");
    expect(swapped?.detail).toContain("250.000");
    expect(swapped?.detail).toContain("100.000");
    expect(swapped?.action).toContain("250.000");
  });

  it("deterministik: input yang sama selalu memberi hasil sama", () => {
    for (const fixture of PAIR_FIXTURES) {
      const a = normalizePrices(fixture.price, fixture.salePrice);
      const b = normalizePrices(fixture.price, fixture.salePrice);
      expect(a).toEqual(b);
    }
  });

  it("idempoten: menormalisasi ulang hasil tidak memicu issue baru", () => {
    for (const fixture of PAIR_FIXTURES) {
      const first = normalizePrices(fixture.price, fixture.salePrice);
      const second = normalizePrices(first.price, first.salePrice);
      expect(second.price).toBe(first.price);
      expect(second.salePrice).toBe(first.salePrice);
      expect(second.discountPercent).toBe(first.discountPercent);
      // Tidak boleh muncul jenis peringatan baru pada pass kedua.
      for (const code of codesOf(second.issues)) {
        expect(codesOf(first.issues)).toContain(code);
      }
    }
  });
});

describe("jejak transformasi (trace)", () => {
  it("setiap langkah memakai rule yang terdaftar dan lengkap isinya", () => {
    const ruleIds = PRICE_RULES.map((r) => r.id);
    for (const fixture of PAIR_FIXTURES) {
      const { trace } = normalizePrices(fixture.price, fixture.salePrice);
      for (const step of trace) {
        expect(ruleIds).toContain(step.rule);
        expect(["price", "salePrice", "both"]).toContain(step.field);
        expect(step.label.length).toBeGreaterThan(5);
        expect(step.from).toBeTruthy();
        expect(step.to).toBeTruthy();
        expect(typeof step.changed).toBe("boolean");
      }
    }
  });

  it("input kosong tidak menghasilkan langkah apa pun", () => {
    expect(normalizePrices(null, null).trace).toHaveLength(0);
    expect(normalizePrices("", "").trace).toHaveLength(0);
  });

  it("mencatat parsing untuk setiap nilai yang ada", () => {
    const { trace } = normalizePrices("Rp1.250.000", "999rb");
    const parses = trace.filter((s) => s.rule === "parse");
    expect(parses).toHaveLength(2);
    expect(parses[0]!.to).toContain("1.250.000");
    expect(parses[1]!.to).toContain("999.000");
  });

  it("mencatat deteksi rentang beserta batas terendah", () => {
    const { trace } = normalizePrices("Rp10.000 - Rp25.000", null);
    const range = trace.find((s) => s.rule === "range");
    expect(range?.changed).toBe(true);
    expect(range?.to).toContain("10.000");
  });

  it("mencatat pertukaran urutan harga vs diskon", () => {
    const swapped = normalizePrices(100_000, 250_000).trace.find((s) => s.rule === "order");
    expect(swapped?.changed).toBe(true);
    expect(swapped?.to).toContain("250.000");

    const fine = normalizePrices(250_000, 100_000).trace.find((s) => s.rule === "order");
    expect(fine?.changed).toBe(false);
  });

  it("mencatat rumus perhitungan diskon persen", () => {
    const { trace, discountPercent } = normalizePrices(200_000, 150_000);
    const step = trace.find((s) => s.rule === "discount");
    expect(discountPercent).toBe(25);
    expect(step?.to).toBe("25%");
    expect(step?.note).toContain("200000");
    expect(step?.note).toContain("150000");
  });

  it("mencatat pembuangan nilai di luar batas", () => {
    const low = normalizePrices(50, null).trace.find((s) => s.rule === "bounds");
    expect(low?.to).toBe("dibuang");
    const high = normalizePrices(MAX_PRICE + 1, null).trace.find((s) => s.rule === "bounds");
    expect(high?.to).toBe("dibuang");
  });

  it("langkah terakhir konsisten dengan hasil akhir", () => {
    const result = normalizePrices("Rp100.000 - Rp120.000", "Rp250.000 - Rp400.000");
    expect(result.price).toBe(250_000);
    expect(result.trace.some((s) => s.rule === "range" && s.changed)).toBe(true);
    expect(result.trace.some((s) => s.rule === "order" && s.changed)).toBe(true);
    expect(result.trace.at(-1)?.rule).toBe("discount");
  });
});
