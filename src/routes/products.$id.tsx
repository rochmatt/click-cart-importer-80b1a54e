import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Heart, ShoppingCart, Star, Zap } from "lucide-react";
import { products } from "@/data/products";
import { useCatalogProduct } from "@/lib/catalog";
import { supabase } from "@/integrations/supabase/client";
import { ProductImageCarousel } from "@/components/store/ProductImageCarousel";
import { ProductDescription } from "@/components/store/ProductDescription";
import { RelatedProducts } from "@/components/store/RelatedProducts";
import { ProductAssurance } from "@/components/store/ProductAssurance";
import { MobileBottomNav } from "@/components/store/MobileBottomNav";

import { useProductImages } from "@/lib/cover-overrides";
import { addToCart } from "@/lib/cart";
import { isWishlisted, toggleWishlist, useWishlist } from "@/lib/wishlist";
import { toast } from "sonner";


export const Route = createFileRoute("/products/$id")({
  loader: async ({ params }) => {
    const seed = products.find((p) => p.id === params.id);
    if (seed) return seed;

    // Products created only in the admin dashboard aren't in the seed catalog.
    // Unknown ids must 404 instead of rendering an empty page.
    const { data } = await supabase
      .from("admin_products")
      .select("id")
      .eq("status", "active")
      .or(`id.eq.${params.id},catalog_ref.eq.${params.id}`)
      .maybeSingle();
    if (!data) throw notFound();
    return null;
  },
  head: ({ loaderData }) => {
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
    };
  },
  component: ProductDetailPage,
  notFoundComponent: ProductNotFound,
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

  if (!product) {
    return isLoading ? (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading product…
      </div>
    ) : (
      <ProductNotFound />
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

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  addToCart({
                    id: product.id,
                    title: product.title,
                    price: product.price,
                    image: images[0],
                  });
                  toast.success("Added to cart", { description: product.title });
                }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-primary px-6 py-3 text-base font-semibold text-primary transition-colors hover:bg-accent"
              >
                <ShoppingCart className="h-5 w-5" />
                Add to Cart
              </button>
              <Link
                to="/checkout"
                search={{ product: product.id, qty: 1 }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-[var(--shadow-brand)] transition-colors hover:bg-primary/90"
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
              className={`inline-flex items-center justify-center gap-2 self-start rounded-full px-4 py-2 text-sm font-medium transition-colors ${
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

        <RelatedProducts currentId={product.id} />
      </main>
    </div>
  );
}

function ProductNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Product not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The product you're looking for doesn't exist or has been removed.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
