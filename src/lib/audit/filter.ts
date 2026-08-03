// Penyusun klausa WHERE untuk audit log dan log email.
//
// Dipisahkan dari audit.functions.ts supaya bisa diuji tanpa menyeret
// createServerFn beserta konteks permintaannya. Ini juga bagian yang paling
// pantas diuji: satu kesalahan penomoran parameter di sini membuat filter
// mencocokkan kolom yang salah, dan hasilnya terlihat masuk akal.

export interface FilterAuditInput {
  cari: string;
  entity: string;
  action: string;
  tanggal: string;
}

export interface FilterEmailInput {
  cari: string;
  status: string;
}

export interface KlausaWhere {
  where: string;
  params: unknown[];
}

/**
 * Nilai SELALU lewat parameter terikat ($1, $2, …), tidak pernah dirangkai ke
 * dalam string SQL — termasuk isi kotak pencarian admin. Merangkainya akan
 * membuat halaman audit, dari semua tempat, menjadi titik injeksi SQL.
 */
export function susunFilterAudit(f: FilterAuditInput): KlausaWhere {
  const syarat: string[] = [];
  const params: unknown[] = [];

  if (f.cari) {
    params.push(`%${f.cari}%`);
    const i = params.length;
    syarat.push(`(entity_label ILIKE $${i} OR actor_email ILIKE $${i} OR detail ILIKE $${i})`);
  }
  if (f.entity !== "semua") {
    params.push(f.entity);
    syarat.push(`entity = $${params.length}`);
  }
  if (f.action !== "semua") {
    params.push(f.action);
    syarat.push(`action = $${params.length}`);
  }
  if (f.tanggal) {
    // Dibandingkan dalam zona waktu server, bukan UTC: admin yang menyaring
    // "3 Agustus" memaksudkan 3 Agustus menurut jamnya sendiri.
    params.push(f.tanggal);
    syarat.push(
      `(created_at AT TIME ZONE current_setting('TimeZone'))::date = $${params.length}::date`,
    );
  }

  return { where: syarat.length ? `WHERE ${syarat.join(" AND ")}` : "", params };
}

export function susunFilterEmail(f: FilterEmailInput): KlausaWhere {
  const syarat: string[] = [];
  const params: unknown[] = [];

  if (f.cari) {
    params.push(`%${f.cari}%`);
    const i = params.length;
    syarat.push(`(recipient ILIKE $${i} OR subject ILIKE $${i} OR order_number ILIKE $${i})`);
  }
  if (f.status !== "semua") {
    params.push(f.status);
    syarat.push(`status = $${params.length}`);
  }

  return { where: syarat.length ? `WHERE ${syarat.join(" AND ")}` : "", params };
}
