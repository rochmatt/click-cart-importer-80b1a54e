import { useEffect } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Check, Heart, ShoppingCart, Star, Zap } from "lucide-react";
import { products } from "@/data/products";
import { useCatalogProduct } from "@/lib/catalog";
import { productExists } from "@/lib/catalog.functions";
import { ProductImageCarousel } from "@/components/store/ProductImageCarousel";
import { ProductDescription } from "@/components/store/ProductDescription";
import { RelatedProducts } from "@/components/store/RelatedProducts";
import { ProductAssurance } from "@/components/store/ProductAssurance";
import { ProductStickyActions } from "@/components/store/ProductStickyActions";

import { useProductImages } from "@/lib/cover-overrides";
import { addToCart } from "@/lib/cart";
import { isWishlisted, toggleWishlist, useWishlist } from "@/lib/wishlist";
import { toast } from "sonner";
import { breadcrumbJsonLd, jsonLdScript, productJsonLd } from "@/lib/structured-data";
import { categorySlug } from "@/data/categories";
import { NotFoundPage } from "@/components/store/NotFoundPage";
import { reviewsForProduct } from "@/data/reviews";
import { ProductReviews } from "@/components/store/ProductReviews";
import { recordView } from "@/lib/recently-viewed";
import { useAddedFeedback } from "@/lib/use-added-feedback";
import { recordProductView } from "@/lib/analytics.functions";

/** Dipakai dua kali: sebagai notFoundComponent, dan saat katalog selesai
 *  dimuat tapi produknya tidak ada di dalamnya. */
function ProdukTidakAda() {
  return (
    <NotFoundPage
      judul="Product not found"
      pesan="This product may have been removed, or the link is mistyped."
    />
  );
}

export const Route = createFileRoute("/products/$id")({
  loader: async ({ params }) => {
    const seed = products.find((p) => p.id === params.id);
    if (seed) return seed;

    // Products created only in the admin dashboard aren't in the seed catalog.
    // Unknown ids must 404 instead of rendering an empty page.
    // Pemeriksaannya pindah ke server function karena datanya kini di
    // PostgreSQL lokal; deteksi uuid ikut pindah ke sana.
    if (!(await productExists({ data: params.id }))) throw notFound();
    return null;
  },
  head: ({ loaderData, params }) => {
    const product = loaderData;
    const title = product ? `${product.title} — PasarPilih` : "Product — PasarPilih";
    const description = product
      ? `${product.description} Compare prices and buy on Shopee, Tokopedia, or TikTok Shop.`
      : "Compare prices and buy on PasarPilih.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `/products/${params.id}` }],
      // Product + BreadcrumbList rich results. Admin-only products aren't in
      // the seed catalog, so the loader returns null and we emit nothing.
      scripts: product
        ? [
            jsonLdScript(
              productJsonLd(product, `/products/${params.id}`, reviewsForProduct(params.id)),
            ),
            jsonLdScript(
              breadcrumbJsonLd([
                { name: "Home", path: "/" },
                {
                  name: product.category,
                  path: `/category/${categorySlug(product.category)}`,
                },
                { name: product.title, path: `/products/${params.id}` },
              ]),
            ),
          ]
        : [],
    };
  },
  component: ProductDetailPage,
  notFoundComponent: ProdukTidakAda,
});

function ProductDetailPage() {
  const { id } = Route.useParams();
  const seed = Route.useLoaderData();
  // Products created only in the admin dashboard aren't in the seed catalog,
  // so fall back to the live catalog for those ids.
  const { product: live, isLoading } = useCatalogProduct(id);
  const product = seed ?? live;
  const images = useProductImages(product?.id ?? id, product?.images ?? []);
  const wishlisted = isWishlisted(useWishlist(), id);
  const { added, tandai } = useAddedFeedback();

  // Satu jalur tambah-ke-keranjang dipakai tombol desktop DAN bar sticky, supaya
  // keduanya menampilkan konfirmasi yang sama dan logikanya tidak menyimpang.
  const tambahKeKeranjang = () => {
    if (!product) return;
    addToCart({ id: product.id, title: product.title, price: product.price, image: images[0] });
    tandai();
    toast.success("Added to cart", { description: product.title });
  };

  // Feeds the "Rekomendasi Untukmu" section on the homepage, dan mencatat view
  // ke analytics server. Keduanya fire-and-forget: analytics tidak boleh menunda
  // atau menggagalkan render halaman, jadi hasilnya sengaja diabaikan.
  const viewedCategory = product?.category;
  useEffect(() => {
    if (!viewedCategory) return;
    recordView(id, viewedCategory);
    void recordProductView({ data: { productRef: id } }).catch(() => {});
  }, [id, viewedCategory]);

  if (!product) {
    return isLoading ? (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading product…
      </div>
    ) : (
      <ProdukTidakAda />
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <ProductImageCarousel images={images} alt={product.title} />

          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                {product.title}
              </h1>
              <div className="mt-3 flex items-center gap-2 text-sm sm:text-base">
                <Star className="h-5 w-5 fill-chart-4 text-chart-4" />
                <span className="font-semibold text-foreground">{product.rating}</span>
                <span className="text-muted-foreground">
                  ({product.reviews.toLocaleString()} reviews)
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-extrabold tracking-tight text-foreground">
                {product.price}
              </span>
              {product.oldPrice && (
                <span className="text-lg text-muted-foreground line-through">
                  {product.oldPrice}
                </span>
              )}
            </div>

            <div className="hidden flex-col gap-3 sm:flex sm:flex-row">
              <button
                type="button"
                onClick={tambahKeKeranjang}
                aria-label={added ? "Added to cart" : "Add to cart"}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full border-2 px-6 py-3 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  added
                    ? "border-success bg-success/10 text-success"
                    : "border-primary text-primary hover:bg-accent"
                }`}
              >
                {added ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
                {added ? "Added" : "Add to Cart"}
              </button>
              <Link
                to="/checkout"
                search={{ product: product.id, qty: 1 }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-[var(--shadow-brand)] transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Zap className="h-5 w-5" />
                Buy Now
              </Link>
            </div>

            <button
              type="button"
              onClick={() => {
                const saved = toggleWishlist({
                  id: product.id,
                  title: product.title,
                  price: product.price,
                  image: images[0],
                });
                toast[saved ? "success" : "message"](
                  saved ? "Saved to wishlist" : "Removed from wishlist",
                  { description: product.title },
                );
              }}
              className={`inline-flex items-center justify-center gap-2 self-start rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                wishlisted ? "text-primary" : "text-muted-foreground hover:text-primary"
              }`}
            >
              <Heart className={`h-4 w-4 ${wishlisted ? "fill-primary" : ""}`} />
              {wishlisted ? "Saved to wishlist" : "Add to wishlist"}
            </button>

            <ProductAssurance />
          </div>
        </div>

        <div className="mt-10 sm:mt-14">
          <ProductDescription
            description={product.description}
            specs={product.specs}
            detailedSpecs={product.detailedSpecs}
          />
        </div>
        <ProductReviews reviews={reviewsForProduct(product.id)} />

        <RelatedProducts currentId={product.id} />
      </main>
      <ProductStickyActions productId={product.id} onAddToCart={tambahKeKeranjang} added={added} />
    </div>
  );
}
