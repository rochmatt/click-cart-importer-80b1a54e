import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link2, Loader2, Sparkles, Wand2, Check, AlertTriangle } from "lucide-react";
import { grabProductByUrl, type GrabbedProduct } from "@/lib/product-grab.functions";
import { formatRupiah, type AdminProduct } from "@/lib/admin-store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type FieldKey = "title" | "description" | "brand" | "price" | "salePrice" | "link";

const FIELD_LABELS: Record<FieldKey, string> = {
  title: "Nama produk",
  description: "Deskripsi",
  brand: "Brand",
  price: "Harga normal",
  salePrice: "Harga diskon",
  link: "Link marketplace",
};

export default function GrabFromUrl({
  maxImages,
  currentImageCount,
  onApply,
}: {
  maxImages: number;
  currentImageCount: number;
  onApply: (patch: Partial<AdminProduct>) => void;
}) {
  const grab = useServerFn(grabProductByUrl);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GrabbedProduct | null>(null);
  const [fields, setFields] = useState<Record<FieldKey, boolean>>({
    title: true,
    description: true,
    brand: true,
    price: true,
    salePrice: true,
    link: true,
  });
  const [pickedImages, setPickedImages] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const room = Math.max(0, maxImages - currentImageCount);

  async function handleGrab(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await grab({ data: { url: url.trim() } });
      setResult(data);
      setPickedImages(data.images.slice(0, room));
      if (!data.title && data.price === null && data.images.length === 0) {
        setError("Tidak ada data produk yang bisa dibaca dari halaman ini. Coba URL lain.");
      } else {
        toast.success("Data produk berhasil dibaca");
      }
    } catch (e) {
      const message = (e as Error).message || "Gagal membaca halaman";
      setError(message.includes("403") ? "Hanya admin yang bisa memakai fitur ini." : message);
    } finally {
      setLoading(false);
    }
  }

  function toggleField(key: FieldKey) {
    setFields((f) => ({ ...f, [key]: !f[key] }));
  }

  function toggleImage(src: string) {
    setPickedImages((prev) =>
      prev.includes(src)
        ? prev.filter((s) => s !== src)
        : prev.length >= room
          ? (toast.error(`Maksimal ${room} gambar lagi bisa ditambahkan`), prev)
          : [...prev, src],
    );
  }

  function apply() {
    if (!result) return;
    setShowConfirm(false);
    const patch: Partial<AdminProduct> = {};
    if (fields.title && result.title) patch.title = result.title;
    if (fields.description && result.description) patch.description = result.description;
    if (fields.brand && result.brand) patch.brand = result.brand;
    if (fields.price && result.price !== null) patch.price = result.price;
    if (fields.salePrice && result.salePrice !== null) patch.salePrice = result.salePrice;
    if (fields.link && result.marketplace) {
      patch.links = {
        shopee: result.marketplace === "shopee" ? result.sourceUrl : "",
        tokopedia: result.marketplace === "tokopedia" ? result.sourceUrl : "",
        tiktok: result.marketplace === "tiktok" ? result.sourceUrl : "",
      };
    }
    onApply({ ...patch, ...(pickedImages.length ? { images: pickedImages } : {}) });
    toast.success("Data diterapkan ke form");
  }

  function openConfirm() {
    if (!result) return;
    setShowConfirm(true);
  }

  const available: FieldKey[] = result
    ? (
        [
          result.title ? "title" : null,
          result.description ? "description" : null,
          result.brand ? "brand" : null,
          result.price !== null ? "price" : null,
          result.salePrice !== null ? "salePrice" : null,
          result.marketplace ? "link" : null,
        ] as (FieldKey | null)[]
      ).filter((k): k is FieldKey => !!k)
    : [];

  function preview(key: FieldKey): string {
    if (!result) return "";
    switch (key) {
      case "title":
        return result.title;
      case "description":
        return result.description.slice(0, 120) + (result.description.length > 120 ? "…" : "");
      case "brand":
        return result.brand;
      case "price":
        return result.price !== null ? formatRupiah(result.price) : "";
      case "salePrice":
        return result.salePrice !== null ? formatRupiah(result.salePrice) : "";
      case "link":
        return `${result.marketplace} · ${result.sourceUrl}`;
    }
  }

  return (
    <section className="rounded-xl border border-primary/30 bg-primary/5 shadow-sm">
      <header className="flex items-start gap-2 border-b border-primary/20 px-4 py-3">
        <Wand2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Grab dari URL</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tempel link produk (Shopee, Tokopedia, TikTok Shop, atau toko lain) — sistem membaca
            nama, deskripsi, harga, brand, dan gambar secara otomatis.
          </p>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <form onSubmit={handleGrab} className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Link2
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://tokopedia.com/toko/nama-produk"
              aria-label="URL produk"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            {loading ? "Membaca…" : "Grab data"}
          </button>
        </form>

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        {result && (
          <div className="space-y-4">
            {result.usedAi && (
              <p className="text-xs text-muted-foreground">
                Sebagian data dilengkapi otomatis oleh AI — mohon periksa sebelum menyimpan.
              </p>
            )}

            {available.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">Data terdeteksi</p>
                <ul className="space-y-1.5">
                  {available.map((key) => (
                    <li key={key}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background p-2.5">
                        <input
                          type="checkbox"
                          checked={fields[key]}
                          onChange={() => toggleField(key)}
                          className="mt-0.5 size-4 shrink-0 accent-primary"
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-foreground">
                            {FIELD_LABELS[key]}
                          </span>
                          <span className="block break-words text-xs text-muted-foreground">
                            {preview(key)}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.images.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  Gambar ({pickedImages.length}/{room} dipilih)
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {result.images.map((src) => {
                    const picked = pickedImages.includes(src);
                    return (
                      <button
                        key={src}
                        type="button"
                        onClick={() => toggleImage(src)}
                        aria-pressed={picked}
                        aria-label={picked ? "Batalkan pilih gambar" : "Pilih gambar"}
                        className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
                          picked ? "border-primary" : "border-border"
                        }`}
                      >
                        <img
                          src={src}
                          alt="Kandidat gambar produk dari URL"
                          loading="lazy"
                          className="size-full object-cover"
                        />
                        {picked && (
                          <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                            <Check className="size-3" aria-hidden="true" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Gambar dipakai langsung dari URL sumber (tidak diunggah ulang).
                </p>
              </div>
            )}

            <div className="space-y-3 rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-semibold text-foreground">
                Pratinjau lengkap sebelum diterapkan
              </p>
              <div className="flex gap-3">
                {pickedImages[0] && (
                  <img
                    src={pickedImages[0]}
                    alt="Pratinjau gambar utama produk"
                    loading="lazy"
                    className="size-20 shrink-0 rounded-lg border border-border object-cover"
                  />
                )}
                <dl className="min-w-0 flex-1 space-y-1.5 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Judul</dt>
                    <dd className="break-words font-medium text-foreground">
                      {fields.title && result.title ? result.title : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Brand</dt>
                    <dd className="break-words font-medium text-foreground">
                      {fields.brand && result.brand ? result.brand : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Harga</dt>
                    <dd className="font-medium text-foreground">
                      {fields.salePrice && result.salePrice !== null && (
                        <span className="mr-2 text-primary">{formatRupiah(result.salePrice)}</span>
                      )}
                      {fields.price && result.price !== null ? (
                        <span
                          className={
                            fields.salePrice && result.salePrice !== null
                              ? "text-muted-foreground line-through"
                              : ""
                          }
                        >
                          {formatRupiah(result.price)}
                        </span>
                      ) : (
                        !(fields.salePrice && result.salePrice !== null) && "—"
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="space-y-1 text-xs">
                <p className="text-muted-foreground">Deskripsi</p>
                <p className="max-h-32 overflow-y-auto whitespace-pre-line break-words text-foreground">
                  {fields.description && result.description ? result.description : "—"}
                </p>
              </div>
              <div className="space-y-1 text-xs">
                <p className="text-muted-foreground">
                  Link marketplace{result.marketplace ? ` (${result.marketplace})` : ""}
                </p>
                {fields.link && result.marketplace ? (
                  <a
                    href={result.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-primary underline"
                  >
                    {result.sourceUrl}
                  </a>
                ) : (
                  <p className="text-foreground">—</p>
                )}
              </div>
              <div className="space-y-1 text-xs">
                <p className="text-muted-foreground">Gambar ({pickedImages.length} dipilih)</p>
                {pickedImages.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {pickedImages.map((src) => (
                      <img
                        key={src}
                        src={src}
                        alt="Pratinjau gambar produk terpilih"
                        loading="lazy"
                        className="size-12 rounded-md border border-border object-cover"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-foreground">—</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={openConfirm}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary bg-background px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 sm:w-auto"
            >
              <Check className="size-4" aria-hidden="true" />
              Terapkan ke form
            </button>

            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 sm:mx-0">
                    <AlertTriangle className="size-6 text-primary" aria-hidden="true" />
                  </div>
                  <AlertDialogTitle>Terapkan data dari URL?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Data berikut akan menimpa isian yang sudah ada di editor produk.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="rounded-lg border border-border bg-background p-3 text-xs">
                  <ul className="space-y-1.5">
                    {available
                      .filter((key) => fields[key])
                      .map((key) => (
                        <li key={key} className="flex items-center gap-2">
                          <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                          <span>{FIELD_LABELS[key]}</span>
                        </li>
                      ))}
                    {pickedImages.length > 0 && (
                      <li className="flex items-center gap-2">
                        <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                        <span>{pickedImages.length} gambar</span>
                      </li>
                    )}
                    {available.filter((key) => fields[key]).length === 0 && pickedImages.length === 0 && (
                      <li className="text-muted-foreground">Tidak ada data yang dipilih.</li>
                    )}
                  </ul>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={apply}>Ya, terapkan ke form</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </section>
  );
}
