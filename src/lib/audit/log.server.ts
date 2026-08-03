// Perekam audit log aksi admin.
//
// ATURAN UTAMA: pencatatan tidak boleh menggagalkan aksi yang dicatatnya.
// Kalau penulisan audit gagal — database penuh, koneksi putus, kolom berubah —
// admin yang sedang menyimpan produk tetap harus berhasil menyimpan produk.
// Karena itu setiap penulisan dibungkus try/catch dan kegagalannya hanya
// dicatat ke log server.
//
// Konsekuensinya jujur: audit log ini bisa berlubang tanpa ada yang tahu. Itu
// pertukaran yang disengaja. Pilihan sebaliknya — menggagalkan penyimpanan
// produk karena audit log bermasalah — menukar fitur yang bekerja dengan fitur
// pengawas, dan admin akan mematikan pengawasnya dalam sehari.

export type EntitasAudit =
  "produk" | "pesanan" | "kategori" | "pengaturan" | "pengguna" | "pengumuman";

export type AksiAudit = "tambah" | "ubah" | "ubah_status" | "hapus" | "pulihkan";

/**
 * Identitas pelaku untuk audit log, diambil dari SESI — bukan dari kiriman
 * klien. Kalau nilainya boleh datang dari permintaan, audit log berhenti
 * menjadi bukti: siapa pun bisa menandatangani aksinya dengan nama orang lain.
 *
 * Ditaruh di sini, bukan disalin di tiap berkas yang memakainya, supaya tidak
 * muncul dua versi yang perlahan berbeda dalam menangani email yang kosong.
 */
export function pelaku(context: { userId: string; claims: Record<string, unknown> }): {
  actorId: string;
  actorEmail: string;
} {
  return {
    actorId: context.userId,
    actorEmail: (context.claims.email as string | undefined) ?? "(tanpa email)",
  };
}

export interface CatatanAudit {
  actorId: string;
  actorEmail: string;
  entity: EntitasAudit;
  entityId?: string | null;
  entityLabel?: string;
  action: AksiAudit;
  detail?: string;
  meta?: unknown;
}

/**
 * Menulis satu baris audit. Tidak pernah melempar.
 *
 * Memakai klien service karena audit_logs sengaja tidak punya policy INSERT —
 * tidak ada jalur tulis lewat RLS, hanya lewat kode ini.
 */
export async function catatAudit(catatan: CatatanAudit): Promise<void> {
  try {
    const { createServiceClient } = await import("@/lib/db/client.server");
    const { error } = await createServiceClient()
      .from("audit_logs")
      .insert({
        actor_id: catatan.actorId,
        actor_email: catatan.actorEmail,
        entity: catatan.entity,
        entity_id: catatan.entityId ?? null,
        entity_label: catatan.entityLabel ?? "",
        action: catatan.action,
        detail: catatan.detail ?? "",
        meta: catatan.meta === undefined ? null : JSON.stringify(catatan.meta),
      });
    if (error) console.error("audit log gagal ditulis", error);
  } catch (error) {
    console.error("audit log gagal ditulis", error);
  }
}

/**
 * Menulis beberapa baris sekaligus, untuk aksi massal seperti menghapus lima
 * produk. Satu baris per produk, bukan satu baris "menghapus 5 produk" — kalau
 * nanti seseorang mencari riwayat satu produk tertentu, baris gabungan tidak
 * akan ditemukan.
 */
export async function catatAuditBanyak(catatan: CatatanAudit[]): Promise<void> {
  if (!catatan.length) return;
  try {
    const { createServiceClient } = await import("@/lib/db/client.server");
    const { error } = await createServiceClient()
      .from("audit_logs")
      .insert(
        catatan.map((c) => ({
          actor_id: c.actorId,
          actor_email: c.actorEmail,
          entity: c.entity,
          entity_id: c.entityId ?? null,
          entity_label: c.entityLabel ?? "",
          action: c.action,
          detail: c.detail ?? "",
          meta: c.meta === undefined ? null : JSON.stringify(c.meta),
        })),
      );
    if (error) console.error("audit log massal gagal ditulis", error);
  } catch (error) {
    console.error("audit log massal gagal ditulis", error);
  }
}

/**
 * Merangkum kolom apa saja yang berubah, untuk kolom detail.
 *
 * Membandingkan lewat JSON.stringify supaya array dan objek ikut terbandingkan
 * isinya, bukan identitasnya — tanpa itu setiap penyimpanan akan melaporkan
 * `images` berubah walau isinya sama persis.
 */
export function kolomBerubah(
  sebelum: Record<string, unknown> | null,
  sesudah: Record<string, unknown>,
): string[] {
  if (!sebelum) return [];
  return Object.keys(sesudah).filter(
    (k) => JSON.stringify(sebelum[k]) !== JSON.stringify(sesudah[k]),
  );
}
