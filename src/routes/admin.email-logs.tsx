import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  Search,
} from "lucide-react";
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
import { adminListEmailLogs } from "@/lib/audit/audit.functions";

export const Route = createFileRoute("/admin/email-logs")({
  head: () => ({
    meta: [
      { title: "Log Email — PasarPilih Admin" },
      { name: "description", content: "Riwayat pengiriman email transaksional beserta statusnya." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminEmailLogsPage,
});

const waktu = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));

function AdminEmailLogsPage() {
  const ambil = useServerFn(adminListEmailLogs);
  const [cari, setCari] = useState("");
  const [status, setStatus] = useState<"semua" | "terkirim" | "gagal">("semua");
  const [halaman, setHalaman] = useState(1);

  const query = useQuery({
    queryKey: ["admin", "email-logs", { cari, status, halaman }],
    queryFn: () => ambil({ data: { cari, status, halaman } }),
    placeholderData: (sebelumnya) => sebelumnya,
  });

  const hasil = query.data;
  const baris = hasil?.baris ?? [];
  const totalHalaman = hasil ? Math.max(1, Math.ceil(hasil.total / hasil.perHalaman)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Log Email</h1>
        <p className="text-sm text-muted-foreground">
          Setiap email yang dikirim aplikasi ini beserta hasilnya.{" "}
          <span className="font-medium">Terkirim</span> berarti diterima Resend — bukan jaminan
          sampai di kotak masuk.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={cari}
            onChange={(e) => {
              setCari(e.target.value);
              setHalaman(1);
            }}
            placeholder="Cari email penerima, subjek, atau nomor pesanan…"
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as typeof status);
            setHalaman(1);
          }}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Status</SelectItem>
            <SelectItem value="terkirim">Terkirim</SelectItem>
            <SelectItem value="gagal">Gagal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Waktu Kirim</th>
                <th className="px-4 py-3 font-medium">Jenis</th>
                <th className="px-4 py-3 font-medium">Penerima</th>
                <th className="px-4 py-3 font-medium">Pesanan</th>
                <th className="px-4 py-3 font-medium">Status</th>
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
                    Gagal memuat log email.
                  </td>
                </tr>
              ) : !baris.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                    Belum ada email yang tercatat.
                  </td>
                </tr>
              ) : (
                baris.map((b) => (
                  <tr key={b.id} className="border-b last:border-0 align-top hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {waktu(b.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{b.kind}</div>
                          <div className="text-xs text-muted-foreground">{b.subject}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{b.recipient}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {b.order_number || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {b.status === "terkirim" ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Terkirim
                        </Badge>
                      ) : (
                        <div className="space-y-1">
                          <Badge
                            variant="outline"
                            className="border-destructive/20 bg-destructive/10 text-destructive"
                          >
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Gagal
                          </Badge>
                          {b.error_message && (
                            <div className="max-w-[320px] break-words text-xs text-muted-foreground">
                              {b.error_message}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasil && hasil.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {hasil.total.toLocaleString("id-ID")} email · halaman {hasil.halaman} dari{" "}
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
