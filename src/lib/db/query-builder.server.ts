// Query builder berbentuk API Supabase, di baliknya SQL ke PostgreSQL lokal.
//
// Dibangun hanya untuk method yang benar-benar dipakai kode ini:
//   select insert update upsert delete | eq neq in gte ilike or | order limit
//   single maybeSingle
//
// KOREKSI: versi pertama berkas ini menyatakan .or() "tidak ada satu pun
// pemanggilannya di repo ini". Itu SALAH — ada tiga (commerce.server.ts:61 dan
// :142, mcp/tools/search-products.ts:31), dua di antaranya di tengah alur
// createOrder. Method yang tidak ada melempar TypeError, bukan mengembalikan
// { error }, sehingga pesanan sudah tersimpan tapi keranjang tidak dikosongkan
// dan email tidak terkirim — pelanggan menekan checkout lagi lalu terjadi
// pesanan ganda. Jangan mengulangi kesalahan itu: verifikasi dengan grep
// sebelum menyatakan sebuah method tidak dipakai.
//
// Sengaja TIDAK meniru embed relasi (select("*, other(*)")), .filter(), atau
// .textSearch() — sudah diverifikasi tidak dipakai. Meniru separuh jalan lebih
// berbahaya daripada tidak sama sekali: pemanggil akan mengira fiturnya ada.
//
// Bentuk kembalian mengikuti Supabase: { data, error }, TIDAK PERNAH melempar.
// Pemanggil yang sudah ada memeriksa `error`, bukan try/catch.

import { run } from "./pool.server";

export interface PostgrestError {
  message: string;
  code: string;
  details: string | null;
}

export interface Result<T = any> {
  data: T | null;
  error: PostgrestError | null;
}

type Op = "select" | "insert" | "update" | "upsert" | "delete";
type RowMode = "many" | "single" | "maybeSingle";

interface Filter {
  column: string;
  operator: "=" | "<>" | ">=" | "IN" | "ILIKE";
  value: unknown;
}

/** Satu grup OR hasil parsing sintaks PostgREST "kolom.op.nilai,kolom.op.nilai". */
interface OrGroup {
  parts: { column: string; operator: "=" | "ILIKE"; value: string }[];
}

const OR_OPERATOR: Record<string, "=" | "ILIKE"> = { eq: "=", ilike: "ILIKE" };

/**
 * Mengurai sintaks .or() PostgREST.
 *
 * Bentuknya "kolom.operator.nilai" dipisah koma, contoh:
 *   catalog_ref.eq.abc,id.eq.abc
 *   title.ilike.%kaos%,brand.ilike.%kaos%
 *
 * Batasan yang sama dengan PostgREST: nilai tidak boleh mengandung koma,
 * karena koma adalah pemisah antar kondisi.
 */
function parseOr(expression: string): OrGroup {
  const parts = expression
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      // split dibatasi 3 supaya nilai yang mengandung titik tetap utuh,
      // misalnya email atau nilai desimal.
      const pisah = entry.split(".");
      const column = pisah.shift() ?? "";
      const op = pisah.shift() ?? "";
      const value = pisah.join(".");
      const operator = OR_OPERATOR[op];
      if (!operator) {
        throw new Error(`Operator .or() tidak didukung: ${JSON.stringify(op)} pada ${entry}`);
      }
      return { column, operator, value };
    });

  if (parts.length === 0) throw new Error(".or() dipanggil tanpa kondisi");
  return { parts };
}

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Nama kolom dan tabel tidak bisa diparameterkan di SQL, jadi satu-satunya
 * pengaman adalah menolak apa pun yang bukan identifier polos. Lebih baik
 * melempar di sini daripada meloloskan string yang dirangkai ke SQL.
 */
function ident(name: string): string {
  const trimmed = name.trim();
  if (!IDENT.test(trimmed)) {
    throw new Error(`Nama kolom/tabel tidak valid: ${JSON.stringify(name)}`);
  }
  return `"${trimmed}"`;
}

function columnList(columns: string): string {
  const trimmed = columns.trim();
  if (trimmed === "" || trimmed === "*") return "*";
  return trimmed
    .split(",")
    .map((c) => ident(c))
    .join(", ");
}

function toPostgrestError(error: unknown): PostgrestError {
  const e = error as { message?: string; code?: string; detail?: string };
  return {
    message: e?.message ?? String(error),
    code: e?.code ?? "UNKNOWN",
    details: e?.detail ?? null,
  };
}

export class QueryBuilder<T = any> implements PromiseLike<Result<T>> {
  private op: Op = "select";
  private columns = "*";
  private returning: string | null = null;
  private payload: Record<string, unknown>[] = [];
  private conflictTarget: string | null = null;
  private filters: Filter[] = [];
  private orExpressions: string[] = [];
  private orderings: { column: string; ascending: boolean }[] = [];
  private limitCount: number | null = null;
  private rowMode: RowMode = "many";

  constructor(
    private readonly table: string,
    private readonly access: { rls: boolean; userId: string | null },
  ) {}

  select(columns = "*"): this {
    // Setelah operasi tulis, .select() berarti RETURNING — bukan query baru.
    if (this.op === "select") this.columns = columns;
    else this.returning = columns;
    return this;
  }

  insert(rows: Record<string, unknown> | Record<string, unknown>[]): this {
    this.op = "insert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.op = "update";
    this.payload = [values];
    return this;
  }

  upsert(
    rows: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string },
  ): this {
    this.op = "upsert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflictTarget = options?.onConflict ?? null;
    return this;
  }

  delete(): this {
    this.op = "delete";
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, operator: "=", value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ column, operator: "<>", value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ column, operator: ">=", value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ column, operator: "IN", value: values });
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.filters.push({ column, operator: "ILIKE", value: pattern });
    return this;
  }

  /**
   * Beberapa kondisi yang digabung OR, sintaks PostgREST.
   *
   * Antar-grup dan terhadap filter lain tetap digabung AND, sama seperti
   * PostgREST — jadi .eq("status","active").or("a.eq.1,b.eq.2") berarti
   * status = 'active' AND (a = 1 OR b = 2).
   */
  or(expression: string): this {
    // Ekspresi disimpan mentah dan baru diurai saat build(), yang berjalan di
    // dalam try/catch execute(). Kalau diurai di sini, ekspresi cacat akan
    // melempar SINKRON di call site — persis kegagalan yang membuat checkout
    // menyisakan pesanan tanpa email dan tanpa keranjang dikosongkan.
    this.orExpressions.push(expression);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderings.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  single(): this {
    this.rowMode = "single";
    return this;
  }

  maybeSingle(): this {
    this.rowMode = "maybeSingle";
    return this;
  }

  private buildWhere(values: unknown[]): string {
    const parts = this.filters.map((f) => {
      const col = ident(f.column);
      if (f.operator === "IN") {
        const list = f.value as unknown[];
        // IN () bukan SQL yang sah. Daftar kosong berarti "tidak ada yang cocok".
        if (list.length === 0) return "false";
        values.push(list);
        return `${col} = ANY($${values.length})`;
      }
      values.push(f.value);
      return `${col} ${f.operator} $${values.length}`;
    });

    for (const group of this.orExpressions.map(parseOr)) {
      const alternatif = group.parts.map((p) => {
        values.push(p.value);
        // Dicasting ke text supaya kolom uuid bisa dibandingkan dengan nilai
        // sembarang tanpa melempar "invalid input syntax for type uuid".
        // PostgREST menolak nilai semacam itu; di sini cukup tidak cocok.
        const kolom = p.operator === "=" ? `${ident(p.column)}::text` : ident(p.column);
        return `${kolom} ${p.operator} $${values.length}`;
      });
      parts.push(`(${alternatif.join(" OR ")})`);
    }

    if (parts.length === 0) return "";
    return ` WHERE ${parts.join(" AND ")}`;
  }

  private build(): { text: string; values: unknown[] } {
    const values: unknown[] = [];
    const table = ident(this.table);

    if (this.op === "select") {
      let text = `SELECT ${columnList(this.columns)} FROM ${table}`;
      text += this.buildWhere(values);
      if (this.orderings.length > 0) {
        const parts = this.orderings.map(
          (o) => `${ident(o.column)} ${o.ascending ? "ASC" : "DESC"}`,
        );
        text += ` ORDER BY ${parts.join(", ")}`;
      }
      if (this.limitCount !== null) {
        values.push(this.limitCount);
        text += ` LIMIT $${values.length}`;
      }
      return { text, values };
    }

    if (this.op === "insert" || this.op === "upsert") {
      // Baris bisa punya himpunan kolom berbeda; disatukan supaya jumlah kolom
      // per baris konsisten. Yang tidak ada diisi NULL agar DEFAULT tabel tidak
      // ikut tertimpa nilai undefined.
      const cols = [...new Set(this.payload.flatMap((r) => Object.keys(r)))];
      if (cols.length === 0) throw new Error("insert/upsert tanpa kolom");

      const tuples = this.payload.map((row) => {
        const placeholders = cols.map((c) => {
          values.push(row[c] ?? null);
          return `$${values.length}`;
        });
        return `(${placeholders.join(", ")})`;
      });

      let text = `INSERT INTO ${table} (${cols.map(ident).join(", ")}) VALUES ${tuples.join(", ")}`;

      if (this.op === "upsert") {
        const target = this.conflictTarget
          ? this.conflictTarget.split(",").map(ident).join(", ")
          : null;
        if (target) {
          const assignments = cols
            .filter(
              (c) =>
                !this.conflictTarget!.split(",")
                  .map((s) => s.trim())
                  .includes(c),
            )
            .map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`);
          text += assignments.length
            ? ` ON CONFLICT (${target}) DO UPDATE SET ${assignments.join(", ")}`
            : ` ON CONFLICT (${target}) DO NOTHING`;
        } else {
          text += " ON CONFLICT DO NOTHING";
        }
      }

      if (this.returning) text += ` RETURNING ${columnList(this.returning)}`;
      return { text, values };
    }

    if (this.op === "update") {
      const row = this.payload[0] ?? {};
      const cols = Object.keys(row);
      if (cols.length === 0) throw new Error("update tanpa kolom");
      const assignments = cols.map((c) => {
        values.push(row[c]);
        return `${ident(c)} = $${values.length}`;
      });
      let text = `UPDATE ${table} SET ${assignments.join(", ")}`;
      text += this.buildWhere(values);
      if (this.returning) text += ` RETURNING ${columnList(this.returning)}`;
      return { text, values };
    }

    let text = `DELETE FROM ${table}`;
    text += this.buildWhere(values);
    if (this.returning) text += ` RETURNING ${columnList(this.returning)}`;
    return { text, values };
  }

  private async execute(): Promise<Result<T>> {
    let rows: any[];
    try {
      const { text, values } = this.build();
      rows = await run(text, values, { rls: this.access.rls, userId: this.access.userId });
    } catch (error) {
      return { data: null, error: toPostgrestError(error) };
    }

    if (this.rowMode === "single") {
      if (rows.length !== 1) {
        return {
          data: null,
          // Kode PGRST116 dipertahankan: sebagian pemanggil membedakan
          // "tidak ketemu" dari error lain lewat kode ini.
          error: {
            message: `Diharapkan tepat 1 baris, dapat ${rows.length}`,
            code: "PGRST116",
            details: null,
          },
        };
      }
      return { data: rows[0] as T, error: null };
    }

    if (this.rowMode === "maybeSingle") {
      if (rows.length > 1) {
        return {
          data: null,
          error: {
            message: `Diharapkan paling banyak 1 baris, dapat ${rows.length}`,
            code: "PGRST116",
            details: null,
          },
        };
      }
      return { data: (rows[0] ?? null) as T, error: null };
    }

    // Operasi tulis tanpa .select() tidak mengembalikan baris; Supabase memberi
    // data null, bukan array kosong.
    if (this.op !== "select" && !this.returning) {
      return { data: null, error: null };
    }
    return { data: rows as T, error: null };
  }

  /** Membuat objek ini bisa di-`await` langsung, sama seperti builder Supabase. */
  then<R1 = Result<T>, R2 = never>(
    onfulfilled?: ((value: Result<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
