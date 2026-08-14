import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Link2,
  Loader2,
  Sparkles,
  Wand2,
  Check,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Pencil,
  ArrowRight,
  ListChecks,
  ChevronDown,
  Coins,
} from "lucide-react";
import { grabProductByUrl, type GrabbedProduct } from "@/lib/product-grab.functions";
import { getMarginTiers } from "@/lib/admin.functions";
import {
  hasConfiguredMargins,
  marginForModal,
  suggestPriceFromModal,
} from "@/lib/margin-tiers";
import { formatRupiah, newId, type AdminProduct } from "@/lib/admin-store";
import { normalizePrices, parsePriceValue, PRICE_RULES } from "@/lib/price-normalize";
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

type FieldKey = "title" | "description" | "brand" | "price" | "salePrice" | "link" | "variations";

const FIELD_LABELS: Record<FieldKey, string> = {
  title: "Nama produk",
  description: "Deskripsi",
  brand: "Brand",
  price: "Harga normal",
  salePrice: "Harga diskon",
  link: "Link marketplace",
  variations: "Varian",
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
  const fetchTiers = useServerFn(getMarginTiers);
  const tiersQuery = useQuery({ queryKey: ["admin", "margin-tiers"], queryFn: () => fetchTiers() });
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
    variations: true,
  });
  const [priceInput, setPriceInput] = useState("");
  const [salePriceInput, setSalePriceInput] = useState("");
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
      setPriceInput(data.price !== null ? String(data.price) : "");
      setSalePriceInput(data.salePrice !== null ? String(data.salePrice) : "");
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

  const editedPrice = priceInput.trim() ? parsePriceValue(priceInput) : null;
  const editedSalePrice = salePriceInput.trim() ? parsePriceValue(salePriceInput) : null;
  const priceInvalid = priceInput.trim().length > 0 && editedPrice === null;
  const salePriceInvalid = salePriceInput.trim().length > 0 && editedSalePrice === null;
  const priceEdited = result ? editedPrice !== result.price : false;
  const salePriceEdited = result ? editedSalePrice !== result.salePrice : false;

  const priceCheck = result
    ? normalizePrices(fields.price ? editedPrice : null, fields.salePrice ? editedSalePrice : null)
    : null;
  const allIssues = result ? [...result.priceIssues, ...(priceCheck?.issues ?? [])] : [];

  // Dropship: modal = harga efektif di sumber (salePrice ?? price). Saran harga
  // jual = modal + margin tingkatnya (lihat Settings → Margin bertingkat).
  const marginTiers = tiersQuery.data ?? [];
  const grabModal = result ? (result.salePrice ?? result.price) : null;
  const dropshipJual = suggestPriceFromModal(grabModal, marginTiers);
  const showDropship =
    !!result && grabModal != null && dropshipJual != null && hasConfiguredMargins(marginTiers);

  function resetPrices() {
    if (!result) return;
    setPriceInput(result.price !== null ? String(result.price) : "");
    setSalePriceInput(result.salePrice !== null ? String(result.salePrice) : "");
  }

  function apply() {
    if (!result) return;
    setShowConfirm(false);
    const patch: Partial<AdminProduct> = {};
    if (fields.title && result.title) patch.title = result.title;
    if (fields.description && result.description) patch.description = result.description;
    if (fields.brand && result.brand) patch.brand = result.brand;
    const checked = normalizePrices(
      fields.price ? editedPrice : null,
      fields.salePrice ? editedSalePrice : null,
    );
    if (fields.price && checked.price !== null) patch.price = checked.price;
    if (fields.salePrice && checked.salePrice !== null) patch.salePrice = checked.salePrice;
    const blocking = checked.issues.filter((i) => i.level === "error");
    if (blocking.length > 0) toast.warning(`${blocking[0]!.title}: ${blocking[0]!.action}`);
    if (fields.link && result.marketplace) {
      patch.links = {
        shopee: result.marketplace === "shopee" ? result.sourceUrl : "",
        tokopedia: result.marketplace === "tokopedia" ? result.sourceUrl : "",
        tiktok: result.marketplace === "tiktok" ? result.sourceUrl : "",
      };
    }
    if (fields.variations && result.variations && result.variations.length > 0) {
      patch.variations = result.variations.map((v) => ({
        id: newId(),
        name: v.name,
        options: v.options,
      }));
    }
    onApply({ ...patch, ...(pickedImages.length ? { images: pickedImages } : {}) });
    toast.success("Data diterapkan ke form");
  }

  function openConfirm() {
    if (!result) return;
    if (priceInvalid || salePriceInvalid) {
      toast.error("Perbaiki format harga yang diedit manual dulu");
      return;
    }
    setShowConfirm(true);
  }

  const available: FieldKey[] = result
    ? (
        [
          result.title ? "title" : null,
          result.description ? "description" : null,
          result.brand ? "brand" : null,
          result.variations && result.variations.length > 0 ? "variations" : null,
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
        return editedPrice !== null ? formatRupiah(editedPrice) : "";
      case "salePrice":
        return editedSalePrice !== null ? formatRupiah(editedSalePrice) : "";
      case "link":
        return `${result.marketplace} · ${result.sourceUrl}`;
      case "variations":
        return (result.variations ?? []).map((v) => `${v.name}: ${v.options}`).join(" · ");
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
            nama, deskripsi, harga, brand, gambar, dan varian (ukuran/warna) secara otomatis.
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

            {showDropship && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Coins className="size-3.5 text-primary" aria-hidden="true" />
                  Harga jual dropship (modal + margin)
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    modal {formatRupiah(grabModal!)} + margin{" "}
                    {formatRupiah(marginForModal(grabModal!, marginTiers))} =
                  </span>
                  <span className="font-semibold text-foreground">{formatRupiah(dropshipJual!)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPriceInput(String(dropshipJual));
                      setSalePriceInput("");
                      toast.success("Harga jual dropship dipakai");
                    }}
                    className="ml-auto inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
                  >
                    Pakai sebagai harga jual
                  </button>
                </div>
              </div>
            )}

            {allIssues.length > 0 && (
              <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="text-xs font-semibold text-foreground">
                  Periksa {allIssues.length} catatan harga sebelum menerapkan
                </p>
                <ul className="space-y-2">
                  {allIssues.map((issue, index) => (
                    <li
                      key={`${issue.code}-${issue.field}-${index}`}
                      className="flex items-start gap-2 text-xs"
                    >
                      {issue.level === "error" ? (
                        <XCircle
                          className="mt-0.5 size-3.5 shrink-0 text-destructive"
                          aria-hidden="true"
                        />
                      ) : (
                        <AlertTriangle
                          className="mt-0.5 size-3.5 shrink-0 text-amber-600"
                          aria-hidden="true"
                        />
                      )}
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`font-semibold ${
                              issue.level === "error" ? "text-destructive" : "text-foreground"
                            }`}
                          >
                            {issue.title}
                          </span>
                          <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {FIELD_LABELS[issue.field === "both" ? "price" : issue.field]}
                            {issue.field === "both" ? " & diskon" : ""}
                          </span>
                        </span>
                        <span className="mt-0.5 block break-words text-muted-foreground">
                          {issue.detail}
                        </span>
                        <span className="mt-0.5 block break-words font-medium text-foreground">
                          Tindakan: {issue.action}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-3 rounded-lg border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Pencil className="size-3.5 text-primary" aria-hidden="true" />
                  Harga &amp; diskon (bisa diedit manual)
                </p>
                {(priceEdited || salePriceEdited) && (
                  <button
                    type="button"
                    onClick={resetPrices}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <RotateCcw className="size-3" aria-hidden="true" />
                    Kembalikan hasil parsing
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="grab-price"
                    className="flex items-center gap-2 text-xs font-medium text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={fields.price}
                      onChange={() => toggleField("price")}
                      aria-label="Terapkan harga normal"
                      className="size-4 shrink-0 accent-primary"
                    />
                    Harga normal
                  </label>
                  <input
                    id="grab-price"
                    type="text"
                    inputMode="numeric"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    disabled={!fields.price}
                    placeholder="cth. 1.250.000 atau 1,2jt"
                    aria-invalid={priceInvalid}
                    className={`h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:opacity-50 ${
                      priceInvalid ? "border-destructive" : "border-border"
                    }`}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {priceInvalid
                      ? "Format harga tidak dikenali."
                      : editedPrice !== null
                        ? `Dibaca sebagai ${formatRupiah(editedPrice)}${priceEdited ? " · diubah manual" : ""}`
                        : "Kosong — harga tidak diterapkan."}
                  </p>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="grab-sale-price"
                    className="flex items-center gap-2 text-xs font-medium text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={fields.salePrice}
                      onChange={() => toggleField("salePrice")}
                      aria-label="Terapkan harga diskon"
                      className="size-4 shrink-0 accent-primary"
                    />
                    Harga diskon
                  </label>
                  <input
                    id="grab-sale-price"
                    type="text"
                    inputMode="numeric"
                    value={salePriceInput}
                    onChange={(e) => setSalePriceInput(e.target.value)}
                    disabled={!fields.salePrice}
                    placeholder="cth. 999.000"
                    aria-invalid={salePriceInvalid}
                    className={`h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:opacity-50 ${
                      salePriceInvalid ? "border-destructive" : "border-border"
                    }`}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {salePriceInvalid
                      ? "Format harga tidak dikenali."
                      : editedSalePrice !== null
                        ? `Dibaca sebagai ${formatRupiah(editedSalePrice)}${salePriceEdited ? " · diubah manual" : ""}`
                        : "Kosong — tanpa harga diskon."}
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Hasil parsing awal: harga{" "}
                {result.price !== null ? formatRupiah(result.price) : "—"} · diskon{" "}
                {result.salePrice !== null ? formatRupiah(result.salePrice) : "—"}
                {priceCheck?.discountPercent != null
                  ? ` · potongan saat ini ${priceCheck.discountPercent}%`
                  : ""}
              </p>
            </div>

            {priceCheck && priceCheck.trace.length > 0 && (
              <details className="group rounded-lg border border-border bg-background">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5">
                  <ListChecks className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-xs font-semibold text-foreground">
                    Rule normalisasi &amp; jejak transformasi
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      ({priceCheck.trace.length} langkah,{" "}
                      {priceCheck.trace.filter((s) => s.changed).length} mengubah nilai)
                    </span>
                  </span>
                  <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>

                <div className="space-y-4 border-t border-border px-3 py-3">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Rule yang dipakai
                    </p>
                    <ul className="space-y-1.5">
                      {PRICE_RULES.map((rule) => {
                        const used = priceCheck.trace.some((s) => s.rule === rule.id);
                        return (
                          <li
                            key={rule.id}
                            className={`flex items-start gap-2 rounded-md border p-2 text-xs ${
                              used
                                ? "border-primary/40 bg-primary/5"
                                : "border-border opacity-60"
                            }`}
                          >
                            <span
                              className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-bold ${
                                used
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                              aria-hidden="true"
                            >
                              {used ? "✓" : "–"}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-semibold text-foreground">
                                {rule.name}
                                {!used && (
                                  <span className="ml-1.5 font-normal text-muted-foreground">
                                    (tidak terpakai)
                                  </span>
                                )}
                              </span>
                              <span className="block break-words text-muted-foreground">
                                {rule.description}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Jejak transformasi
                    </p>
                    <ol className="space-y-2">
                      {priceCheck.trace.map((step, index) => (
                        <li
                          key={`${step.rule}-${step.field}-${index}`}
                          className="flex items-start gap-2 text-xs"
                        >
                          <span
                            className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground"
                            aria-hidden="true"
                          >
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-foreground">{step.label}</span>
                              {!step.changed && (
                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  tanpa perubahan
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 break-words">
                              <span className="text-muted-foreground line-clamp-2">{step.from}</span>
                              <ArrowRight
                                className="size-3 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                              <span className="font-medium text-foreground">{step.to}</span>
                            </span>
                            {step.note && (
                              <code className="mt-0.5 block break-words rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {step.note}
                              </code>
                            )}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <p className="pt-1 text-[11px] text-muted-foreground">
                      Hasil akhir yang akan diterapkan: harga{" "}
                      {priceCheck.price !== null ? formatRupiah(priceCheck.price) : "—"} · diskon{" "}
                      {priceCheck.salePrice !== null ? formatRupiah(priceCheck.salePrice) : "—"}
                      {priceCheck.discountPercent !== null
                        ? ` · potongan ${priceCheck.discountPercent}%`
                        : ""}
                    </p>
                  </div>
                </div>
              </details>
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
                      {priceCheck?.salePrice != null && (
                        <span className="mr-2 text-primary">
                          {formatRupiah(priceCheck.salePrice)}
                        </span>
                      )}
                      {priceCheck?.price != null ? (
                        <span
                          className={
                            priceCheck.salePrice != null ? "text-muted-foreground line-through" : ""
                          }
                        >
                          {formatRupiah(priceCheck.price)}
                        </span>
                      ) : (
                        priceCheck?.salePrice == null && "—"
                      )}
                      {priceCheck?.discountPercent != null && (
                        <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          -{priceCheck.discountPercent}%
                        </span>
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
              disabled={priceInvalid || salePriceInvalid}
              className="inline-flex h-10 w-full disabled:opacity-50 items-center justify-center gap-2 rounded-lg border border-primary bg-background px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 sm:w-auto"
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
                    {fields.price && priceCheck?.price != null && (
                      <li className="flex items-center gap-2">
                        <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                        <span>
                          Harga normal {formatRupiah(priceCheck.price)}
                          {priceEdited ? " (diedit manual)" : ""}
                        </span>
                      </li>
                    )}
                    {fields.salePrice && priceCheck?.salePrice != null && (
                      <li className="flex items-center gap-2">
                        <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                        <span>
                          Harga diskon {formatRupiah(priceCheck.salePrice)}
                          {salePriceEdited ? " (diedit manual)" : ""}
                        </span>
                      </li>
                    )}
                    {pickedImages.length > 0 && (
                      <li className="flex items-center gap-2">
                        <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                        <span>{pickedImages.length} gambar</span>
                      </li>
                    )}
                    {available.filter((key) => fields[key]).length === 0 &&
                      pickedImages.length === 0 &&
                      priceCheck?.price == null &&
                      priceCheck?.salePrice == null && (
                        <li className="text-muted-foreground">Tidak ada data yang dipilih.</li>
                      )}
                  </ul>
                  {priceCheck && priceCheck.trace.length > 0 && (
                    <p className="mt-2 border-t border-border pt-2 text-muted-foreground">
                      {priceCheck.trace.length} langkah normalisasi diterapkan (
                      {priceCheck.trace.filter((s) => s.changed).length} mengubah nilai) — detailnya
                      ada di panel “Rule normalisasi &amp; jejak transformasi”.
                    </p>
                  )}
                  {allIssues.length > 0 && (
                    <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                      {allIssues.map((issue, index) => (
                        <li
                          key={`confirm-${issue.code}-${index}`}
                          className="flex items-start gap-2"
                        >
                          <AlertTriangle
                            className={`mt-0.5 size-3.5 shrink-0 ${
                              issue.level === "error" ? "text-destructive" : "text-amber-600"
                            }`}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 text-left">
                            <span className="block font-semibold">{issue.title}</span>
                            <span className="block break-words text-muted-foreground">
                              {issue.action}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
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
