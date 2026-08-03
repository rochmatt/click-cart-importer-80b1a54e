import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Loader2,
  Package,
  RotateCcw,
  Search,
  Settings,
  ShoppingCart,
  Tags,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminExportAudit,
  adminListAudit,
  MAKS_EKSPOR,
  type BarisAudit,
} from "@/lib/audit/audit.functions";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log — PasarPilih Admin" },
      { name: "description", content: "Riwayat aksi admin pada produk, kategori, dan pengaturan." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAuditPage,
});

const IKON_ENTITAS: Record<string, typeof Package> = {
  produk: Package,
  pesanan: ShoppingCart,
  kategori: Tags,
  pengaturan: Settings,
  pengguna: Users,
  pengumuman: History,
};

const LABEL_AKSI: Record<string, string> = {
  tambah: "Tambah",
  ubah: "Ubah",
  ubah_status: "Ubah Status",
  hapus: "Hapus",
  pulihkan: "Pulihkan",
};

/**
 * Warna lencana aksi. Hanya token semantik, tidak ada hex — halaman ini ikut
 * mode gelap seperti sisa panel admin.
 */
function gayaAksi(action: string): string {
  switch (action) {
    case "tambah":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "hapus":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "ubah_status":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "pulihkan":
      return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

const waktu = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));

/**
 * Membungkus satu sel CSV.
 *
 * Sel yang diawali =, +, -, atau @ diberi kutip tunggal di depan. Tanpa itu
 * Excel memperlakukannya sebagai rumus, dan sebuah nama produk yang kebetulan
 * dimulai dengan "=" berubah menjadi perintah yang dijalankan saat file dibuka.
 */
function selCsv(nilai: unknown): string {
  const teks = nilai === null || nilai === undefined ? "" : String(nilai);
  const aman = /^[=+\-@]/.test(teks) ? `'${teks}` : teks;
  return `"${aman.replace(/"/g, '""')}"`;
}

function unduhCsv(baris: BarisAudit[]): void {
  const kepala = ["Waktu", "Entitas", "Aksi", "Target", "Admin", "Detail"];
  const isi = baris.map((b) =>
    [
      waktu(b.created_at),
      b.entity,
      LABEL_AKSI[b.action] ?? b.action,
      b.entity_label,
      b.actor_email,
      b.detail,
    ]
      .map(selCsv)
      .join(","),
  );

  // BOM UTF-8 di depan: tanpa ini Excel di Windows membaca file sebagai ANSI
  // dan setiap karakter beraksen berubah jadi simbol acak. Ditulis sebagai
  // escape, bukan karakter literal — BOM tidak terlihat di editor, jadi versi
  // literalnya tampak seperti baris tanpa awalan apa pun.
  const teks = `\ufeff${[kepala.map(selCsv).join(","), ...isi].join("\r\n")}`;
  const blob = new Blob([teks], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminAuditPage() {
  const ambilAudit = useServerFn(adminListAudit);
  const ambilEkspor = useServerFn(adminExportAudit);

  const [cari, setCari] = useState("");
  const [entity, setEntity] = useState("semua");
  const [action, setAction] = useState("semua");
  const [tanggal, setTanggal] = useState("");
  const [halaman, setHalaman] = useState(1);
  const [mengekspor, setMengekspor] = useState(false);

  const filter = { cari, entity, action, tanggal, halaman };

  const query = useQuery({
    queryKey: ["admin", "audit", filter],
    queryFn: () => ambilAudit({ data: filter }),
    // Data lama tetap tampil saat filter berubah, jadi tabel tidak berkedip
    // kosong setiap ketikan di kotak pencarian.
    placeholderData: (sebelumnya) => sebelumnya,
  });

  const hasil = query.data;
  const baris = hasil?.baris ?? [];
  const totalHalaman = hasil ? Math.max(1, Math.ceil(hasil.total / hasil.perHalaman)) : 1;

  function ubahFilter(fn: () => void) {
    fn();
    setHalaman(1);
  }

  function reset() {
    setCari("");
    setEntity("semua");
    setAction("semua");
    setTanggal("");
    setHalaman(1);
  }

  async function ekspor() {
    setMengekspor(true);
    try {
      const { baris: semua, terpotong } = await ambilEkspor({ data: filter });
      if (!semua.length) {
        toast.error("Tidak ada data untuk diekspor dengan filter ini");
        return;
      }
      unduhCsv(semua);
      if (terpotong) {
        toast.warning(
          `Ekspor dibatasi ${MAKS_EKSPOR.toLocaleString("id-ID")} baris terbaru. Persempit filter untuk sisanya.`,
        );
      } else {
        toast.success(`${semua.length.toLocaleString("id-ID")} baris diekspor`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal mengekspor");
    } finally {
      setMengekspor(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Riwayat setiap aksi admin. Catatan bersifat hanya-tambah dan tidak bisa diubah.
          </p>
        </div>
        <Button onClick={ekspor} disabled={mengekspor} variant="outline">
          {mengekspor ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={cari}
            onChange={(e) => ubahFilter(() => setCari(e.target.value))}
            placeholder="Cari target, admin, atau detail…"
            className="pl-9"
          />
        </div>

        <Select value={entity} onValueChange={(v) => ubahFilter(() => setEntity(v))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Entitas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Entitas</SelectItem>
            <SelectItem value="produk">Produk</SelectItem>
            <SelectItem value="kategori">Kategori</SelectItem>
            <SelectItem value="pesanan">Pesanan</SelectItem>
            <SelectItem value="pengaturan">Pengaturan</SelectItem>
            <SelectItem value="pengguna">Pengguna</SelectItem>
          </SelectContent>
        </Select>

        <Select value={action} onValueChange={(v) => ubahFilter(() => setAction(v))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Aksi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Aksi</SelectItem>
            <SelectItem value="tambah">Tambah</SelectItem>
            <SelectItem value="ubah">Ubah</SelectItem>
            <SelectItem value="ubah_status">Ubah Status</SelectItem>
            <SelectItem value="hapus">Hapus</SelectItem>
            <SelectItem value="pulihkan">Pulihkan</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={tanggal}
          onChange={(e) => ubahFilter(() => setTanggal(e.target.value))}
          className="w-[170px]"
        />

        <Button variant="ghost" onClick={reset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Waktu</th>
                <th className="px-4 py-3 font-medium">Aksi</th>
                <th className="px-4 py-3 font-medium">Target / Entitas</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {query.isPending ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : query.isError ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-destructive">
                    Gagal memuat audit log.
                  </td>
                </tr>
              ) : !baris.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                    Belum ada catatan yang cocok dengan filter ini.
                  </td>
                </tr>
              ) : (
                baris.map((b) => {
                  const Ikon = IKON_ENTITAS[b.entity] ?? History;
                  return (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {waktu(b.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={gayaAksi(b.action)}>
                          {LABEL_AKSI[b.action] ?? b.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Ikon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium">{b.entity_label || "—"}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {b.actor_email}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{b.detail || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasil && hasil.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {hasil.total.toLocaleString("id-ID")} catatan · halaman {hasil.halaman} dari{" "}
            {totalHalaman}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={halaman <= 1}
              onClick={() => setHalaman((h) => h - 1)}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={halaman >= totalHalaman}
              onClick={() => setHalaman((h) => h + 1)}
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
