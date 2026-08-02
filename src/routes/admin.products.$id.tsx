import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowLeft,
  Bold,
  Italic,
  List,
  Link2,
  UploadCloud,
  X,
  Plus,
  Trash2,
  ShoppingBag,
  Store,
  Music2,
  Star,
  Loader2,
} from "lucide-react";
import {
  useAdminProduct,
  emptyProduct,
  useSaveProduct,
  uploadProductImages,
  newId,
  CATEGORIES,
  type AdminProduct,
} from "@/lib/admin-store";
import CategorySelect from "@/components/admin/CategorySelect";
import SpecificationsCard from "@/components/admin/SpecificationsCard";


export const Route = createFileRoute("/admin/products/$id")({
  head: () => ({
    meta: [
      { title: "Edit Product — PasarPilih Admin" },
      {
        name: "description",
        content:
          "Edit product details, media, pricing, variations and Shopee, Tokopedia and TikTok redirect links.",
      },
      { property: "og:title", content: "Edit Product — PasarPilih Admin" },
      {
        property: "og:description",
        content: "Full product editor with media, pricing, variations and marketplace URLs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProductEditor,
});

const urlField = z.union([z.literal(""), z.string().trim().url("Enter a valid URL (https://…)")]);

const schema = z.object({
  title: z.string().trim().min(3, "Product name must be at least 3 characters").max(140),
  category: z
    .string()
    .min(1, "Pick a category")
    .refine((v) => CATEGORIES.includes(v), "Choose a category from the list"),
  description: z.string().trim().max(4000).optional(),
  price: z.number().min(1, "Regular price is required"),
  salePrice: z.number().nullable(),
  links: z.object({ shopee: urlField, tokopedia: urlField, tiktok: urlField }),
  seoTitle: z.string().max(60, "Keep the meta title under 60 characters"),
  seoDescription: z.string().max(160, "Keep the meta description under 160 characters"),
});

type Errors = Record<string, string>;

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-xs text-destructive">
          {error}
        </span>
      ) : (
        hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

const MAX_IMAGE_MB = 5;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
const MAX_IMAGES = 8;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const ACCEPTED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif"];

const MARKETPLACES = [
  { key: "shopee", label: "Shopee Link", icon: ShoppingBag, tone: "text-shopee", placeholder: "https://shopee.co.id/product/…" },
  { key: "tokopedia", label: "Tokopedia Link", icon: Store, tone: "text-tokopedia", placeholder: "https://tokopedia.com/store/…" },
  { key: "tiktok", label: "TikTok Shop Link", icon: Music2, tone: "text-tiktok", placeholder: "https://tiktok.com/shop/…" },
] as const;

function ProductEditor() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const query = useAdminProduct(isNew ? "" : id);
  const saveMutation = useSaveProduct();
  const [form, setForm] = useState<AdminProduct>(() => emptyProduct());
  const [loaded, setLoaded] = useState(isNew);
  const [errors, setErrors] = useState<Errors>({});
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageErrors, setImageErrors] = useState<string[]>([]);
  const [dragImage, setDragImage] = useState<number | null>(null);
  const [overImage, setOverImage] = useState<number | null>(null);

  function moveImage(from: number, to: number) {
    setForm((f) => {
      if (from === to || from < 0 || to < 0 || from >= f.images.length || to >= f.images.length)
        return f;
      const images = [...f.images];
      const [moved] = images.splice(from, 1);
      images.splice(to, 0, moved);
      return { ...f, images };
    });
  }

  const fileRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isNew && query.data && !loaded) {
      setForm(query.data);
      setLoaded(true);
    }
  }, [isNew, query.data, loaded]);

  const loading = !isNew && query.isPending;
  const notFound = !isNew && !query.isPending && !query.data;

  function set<K extends keyof AdminProduct>(key: K, value: AdminProduct[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    // Clear related inline errors as soon as the admin edits the field.
    setErrors((prev) => {
      if (!Object.keys(prev).length) return prev;
      const next = { ...prev };
      delete next[key as string];
      if (key === "warrantyStatus") delete next.warrantyDuration;
      if (key === "customAttributes") {
        for (const k of Object.keys(next)) if (k.startsWith("attr.")) delete next[k];
      }
      return next;
    });
  }


  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const incoming = Array.from(files);
    const problems: string[] = [];
    const picked: File[] = [];

    for (const file of incoming) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXTENSIONS.includes(ext)) {
        problems.push(`“${file.name}” is not a supported image (use JPG, PNG, WebP or AVIF).`);
        continue;
      }
      if (file.size === 0) {
        problems.push(`“${file.name}” is empty and cannot be uploaded.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        problems.push(
          `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_IMAGE_MB} MB.`,
        );
        continue;
      }
      picked.push(file);
    }

    const room = MAX_IMAGES - form.images.length;
    if (room <= 0) {
      problems.push(`You already have the maximum of ${MAX_IMAGES} images. Remove one to add another.`);
      picked.length = 0;
    } else if (picked.length > room) {
      problems.push(`Only ${room} more image(s) can be added — the rest were skipped.`);
      picked.length = room;
    }

    setImageErrors(problems);
    if (!picked.length) {
      if (problems.length) toast.error(problems[0]);
      return;
    }

    setErrors((prev) => {
      if (!prev.images) return prev;
      const next = { ...prev };
      delete next.images;
      return next;
    });
    setUploading(true);
    try {
      const urls = await uploadProductImages(picked);
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
      toast.success(`${urls.length} image(s) uploaded`);
    } catch (e) {
      const message = `Upload failed: ${(e as Error).message}`;
      setImageErrors((prev) => [...prev, message]);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }


  function wrapSelection(before: string, after = before) {
    const el = descRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const next = `${value.slice(0, s)}${before}${value.slice(s, e)}${after}${value.slice(e)}`;
    set("description", next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, e + before.length);
    });
  }

  function save() {
    const result = schema.safeParse({
      title: form.title,
      category: form.category,
      description: form.description,
      price: form.price,
      salePrice: form.salePrice,
      links: form.links,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
    });

    const next: Errors = {};
    if (!result.success) {
      for (const issue of result.error.issues) next[issue.path.join(".")] = issue.message;
    }
    if (form.salePrice !== null && form.salePrice >= form.price && form.price > 0) {
      next.salePrice = "Sale price must be lower than the regular price";
    }
    if (form.images.length === 0) next.images = "Add at least one product image";
    else if (form.images.length > MAX_IMAGES)
      next.images = `Remove some images — the limit is ${MAX_IMAGES}`;
    if (uploading) next.images = "Wait for the image upload to finish before saving";

    // Specifications
    const duration = form.warrantyDuration.trim();
    if (form.warrantyStatus !== "none") {
      if (!duration) {
        next.warrantyDuration = "Warranty duration is required when a warranty is offered";
      } else if (!/^\d+\s*(day|days|week|weeks|month|months|year|years)$/i.test(duration)) {
        next.warrantyDuration = "Use a format like “6 Months” or “1 Year”";
      }
    } else if (duration) {
      next.warrantyDuration = "Remove the duration or select a warranty status";
    }

    const sizes = form.sizeOptions.map((s) => s.trim());
    if (sizes.some((s) => !s)) next.sizeOptions = "Size options cannot be empty";
    else if (sizes.some((s) => s.length > 20)) next.sizeOptions = "Each size must be 20 characters or fewer";
    else if (new Set(sizes.map((s) => s.toLowerCase())).size !== sizes.length)
      next.sizeOptions = "Remove duplicate size options";
    else if (sizes.length > 30) next.sizeOptions = "Add at most 30 size options";

    const seenKeys = new Set<string>();
    for (const attr of form.customAttributes) {
      const key = attr.key.trim();
      const value = attr.value.trim();
      if (!key) next[`attr.${attr.id}.key`] = "Attribute name is required";
      else if (key.length > 40) next[`attr.${attr.id}.key`] = "Max 40 characters";
      else if (seenKeys.has(key.toLowerCase()))
        next[`attr.${attr.id}.key`] = "Duplicate attribute name";
      else seenKeys.add(key.toLowerCase());

      if (!value) next[`attr.${attr.id}.value`] = "Value is required";
      else if (value.length > 200) next[`attr.${attr.id}.value`] = "Max 200 characters";
    }

    setErrors(next);
    if (Object.keys(next).length) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    saveMutation.mutate(form, {
      onSuccess: () => {
        toast.success("Product saved successfully");
        navigate({ to: "/admin/products" });
      },
      onError: (e: Error) => toast.error(`Could not save product: ${e.message}`),
    });
  }

  if (loading) {
    return (
      <div className="grid place-items-center rounded-xl border border-border bg-card p-16 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">Loading product…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">That product no longer exists.</p>
        <Link to="/admin/products" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          Back to products
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/products"
            aria-label="Back to products"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {isNew ? "Add product" : "Edit product"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isNew ? "Create a new catalog entry" : form.title || "Untitled product"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <GrabFromUrl
            maxImages={MAX_IMAGES}
            currentImageCount={form.images.length}
            onApply={(patch) => {
              setForm((f) => ({
                ...f,
                ...patch,
                links: patch.links
                  ? {
                      shopee: patch.links.shopee || f.links.shopee,
                      tokopedia: patch.links.tokopedia || f.links.tokopedia,
                      tiktok: patch.links.tiktok || f.links.tiktok,
                    }
                  : f.links,
                images: patch.images ? [...f.images, ...patch.images].slice(0, MAX_IMAGES) : f.images,
              }));
              setErrors({});
            }}
          />
          <Card title="General information" description="Basic details buyers see first.">

            <Field label="Product name" error={errors.title} hint="Keep it descriptive — max 140 characters.">
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Aurora Wireless Headphones — Noise Cancelling"
                className={inputClass}
              />
            </Field>

            <Field label="Category" error={errors.category}>
              <CategorySelect
                value={form.category}
                onChange={(v) => set("category", v)}
                invalid={Boolean(errors.category)}
              />

            </Field>


            <Field
              label="Product description"
              hint="Use the toolbar for simple markdown formatting. Shown on the product detail page."
            >
              <div className="rounded-lg border border-border focus-within:border-primary">
                <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
                  {[
                    { icon: Bold, label: "Bold", run: () => wrapSelection("**") },
                    { icon: Italic, label: "Italic", run: () => wrapSelection("_") },
                    { icon: List, label: "Bullet list", run: () => wrapSelection("\n- ", "") },
                    { icon: Link2, label: "Link", run: () => wrapSelection("[", "](https://)") },
                  ].map((b) => (
                    <button
                      key={b.label}
                      type="button"
                      aria-label={b.label}
                      onClick={b.run}
                      className="grid h-7 w-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <b.icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
                <textarea
                  ref={descRef}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={6}
                  placeholder="Describe materials, what's in the box, warranty…"
                  className="w-full resize-y rounded-b-lg bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </Field>
          </Card>

          <Card
            title="Media"
            description="First image is the main thumbnail. Drag files in or browse from your device."
          >
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              className={`grid place-items-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
                dragging ? "border-primary bg-accent/40" : "border-border bg-muted/40"
              }`}
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <UploadCloud className="h-6 w-6 text-muted-foreground" />
              )}
              <p className="mt-2 text-sm font-medium text-foreground">
                Drag &amp; drop images here
              </p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WebP or AVIF · up to {MAX_IMAGE_MB} MB each · max {MAX_IMAGES} images (
                {form.images.length}/{MAX_IMAGES} used)
              </p>
              <button
                type="button"
                disabled={uploading || form.images.length >= MAX_IMAGES}
                onClick={() => fileRef.current?.click()}
                className="mt-3 inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Browse files"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
                multiple
                aria-label="Upload product images"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            {errors.images && (
              <p role="alert" className="text-xs text-destructive">
                {errors.images}
              </p>
            )}
            {imageErrors.length > 0 && (
              <ul role="alert" className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                {imageErrors.map((message) => (
                  <li key={message} className="text-xs text-destructive">
                    {message}
                  </li>
                ))}
              </ul>
            )}


            {form.images.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground">
                  Drag thumbnails to reorder — the first image is the main thumbnail.
                </p>
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {form.images.map((src, i) => (
                    <li
                      key={`${src}-${i}`}
                      draggable
                      onDragStart={(e) => {
                        setDragImage(i);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(i));
                      }}
                      onDragOver={(e) => {
                        if (dragImage === null) return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                        setOverImage(i);
                      }}
                      onDragLeave={() => setOverImage((p) => (p === i ? null : p))}
                      onDrop={(e) => {
                        if (dragImage === null) return;
                        e.preventDefault();
                        e.stopPropagation();
                        moveImage(dragImage, i);
                        setDragImage(null);
                        setOverImage(null);
                      }}
                      onDragEnd={() => {
                        setDragImage(null);
                        setOverImage(null);
                      }}
                      className={`group relative cursor-grab active:cursor-grabbing transition-opacity ${
                        dragImage === i ? "opacity-40" : ""
                      } ${overImage === i && dragImage !== i ? "ring-2 ring-primary rounded-lg" : ""}`}
                    >
                      <img
                        src={src}
                        alt={`Product image ${i + 1}`}
                        draggable={false}
                        className="aspect-square w-full rounded-lg border border-border object-cover"
                      />
                      {i === 0 ? (
                        <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                          <Star className="h-2.5 w-2.5" /> Cover
                        </span>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Set image ${i + 1} as cover`}
                          onClick={() => {
                            moveImage(i, 0);
                            toast.success("Cover image updated");
                          }}
                          className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-card/90 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                        >
                          <Star className="h-2.5 w-2.5" /> Set as cover
                        </button>
                      )}

                      <button
                        type="button"
                        aria-label={`Remove image ${i + 1}`}
                        onClick={() => {
                          setImageErrors([]);
                          set("images", form.images.filter((_, idx) => idx !== i));
                        }}
                        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-card/90 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          aria-label={`Move image ${i + 1} left`}
                          disabled={i === 0}
                          onClick={() => moveImage(i, i - 1)}
                          className="grid h-6 w-6 place-items-center rounded-full bg-card/90 text-xs text-muted-foreground hover:text-primary disabled:opacity-30"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          aria-label={`Move image ${i + 1} right`}
                          disabled={i === form.images.length - 1}
                          onClick={() => moveImage(i, i + 1)}
                          className="grid h-6 w-6 place-items-center rounded-full bg-card/90 text-xs text-muted-foreground hover:text-primary disabled:opacity-30"
                        >
                          ›
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

          </Card>

          <Card title="Product variations" description="Optional attributes such as size or colour.">
            {form.variations.length === 0 && (
              <p className="text-xs text-muted-foreground">No variations yet.</p>
            )}
            <div className="space-y-3">
              {form.variations.map((v) => (
                <div key={v.id} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Field label="Attribute">
                      <input
                        value={v.name}
                        onChange={(e) =>
                          set(
                            "variations",
                            form.variations.map((x) =>
                              x.id === v.id ? { ...x, name: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="Size"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <div className="flex-[2]">
                    <Field label="Options" hint="Separate each option with a comma.">
                      <input
                        value={v.options}
                        onChange={(e) =>
                          set(
                            "variations",
                            form.variations.map((x) =>
                              x.id === v.id ? { ...x, options: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="S, M, L, XL"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${v.name || "variation"}`}
                    onClick={() => set("variations", form.variations.filter((x) => x.id !== v.id))}
                    className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                set("variations", [...form.variations, { id: newId(), name: "", options: "" }])
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="h-4 w-4" /> Add variation
            </button>
          </Card>

          <SpecificationsCard form={form} set={set} errors={errors} />



          <Card
            title="Marketplace URLs"
            description="Where buyers are redirected to complete the purchase."
          >
            {MARKETPLACES.map((m) => (
              <Field
                key={m.key}
                label={m.label}
                error={errors[`links.${m.key}`]}
                hint="Leave empty to hide this marketplace on the product page."
              >
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 focus-within:border-primary">
                  <m.icon className={`h-4 w-4 shrink-0 ${m.tone}`} />
                  <input
                    value={form.links[m.key]}
                    onChange={(e) => set("links", { ...form.links, [m.key]: e.target.value })}
                    placeholder={m.placeholder}
                    className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </Field>
            ))}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Pricing & status">
            <Field label="Regular price (Rp)" error={errors.price}>
              <input
                type="number"
                min={0}
                value={form.price || ""}
                onChange={(e) => set("price", Number(e.target.value))}
                placeholder="549000"
                className={inputClass}
              />
            </Field>
            <Field
              label="Sale price (Rp)"
              error={errors.salePrice}
              hint="Optional. Must be lower than the regular price."
            >
              <input
                type="number"
                min={0}
                value={form.salePrice ?? ""}
                onChange={(e) =>
                  set("salePrice", e.target.value === "" ? null : Number(e.target.value))
                }
                placeholder="449000"
                className={inputClass}
              />
            </Field>
            <Field label="Stock quantity">
              <input
                type="number"
                min={0}
                value={form.stock}
                onChange={(e) => set("stock", Number(e.target.value))}
                className={inputClass}
              />
            </Field>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-foreground">Publish status</p>
                <p className="text-xs text-muted-foreground">
                  {form.status === "active" ? "Visible in the storefront" : "Hidden as a draft"}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.status === "active"}
                aria-label="Publish status"
                onClick={() => set("status", form.status === "active" ? "draft" : "active")}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  form.status === "active" ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-transform ${
                    form.status === "active" ? "translate-x-[1.4rem]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </Card>

          <Card title="Extra details" description="Shipping data and search engine preview.">
            <Field label="Weight" hint="Used to estimate shipping cost.">
              <input
                value={form.weight}
                onChange={(e) => set("weight", e.target.value)}
                placeholder="500 g"
                className={inputClass}
              />
            </Field>
            <Field label="Dimensions" hint="Length × width × height, packed.">
              <input
                value={form.dimensions}
                onChange={(e) => set("dimensions", e.target.value)}
                placeholder="30 × 20 × 10 cm"
                className={inputClass}
              />
            </Field>
            <Field
              label="SEO meta title"
              error={errors.seoTitle}
              hint={`${form.seoTitle.length}/60 characters`}
            >
              <input
                value={form.seoTitle}
                onChange={(e) => set("seoTitle", e.target.value)}
                placeholder="Aurora Wireless Headphones | PasarPilih"
                className={inputClass}
              />
            </Field>
            <Field
              label="SEO meta description"
              error={errors.seoDescription}
              hint={`${form.seoDescription.length}/160 characters`}
            >
              <textarea
                value={form.seoDescription}
                onChange={(e) => set("seoDescription", e.target.value)}
                rows={3}
                placeholder="Short summary shown in Google results."
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </Field>
          </Card>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto hidden text-xs text-muted-foreground sm:block">
            {form.status === "active" ? "Will be published immediately" : "Saved as draft"}
          </span>
          <Link
            to="/admin/products"
            className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={saveMutation.isPending || uploading}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-60"
          >
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {saveMutation.isPending ? "Saving…" : "Save product"}
          </button>
        </div>
      </div>
    </div>
  );
}
