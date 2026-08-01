import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { addToCart } from "@/lib/cart";
import { removeFromWishlist, useWishlist } from "@/lib/wishlist";

const title = "My Wishlist — PasarPilih";
const description =
  "Everything you saved for later on PasarPilih. Move items to your cart and check out whenever you're ready.";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const [query, setQuery] = useState("");
  const items = useWishlist();

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar />
      <Header query={query} onQueryChange={setQuery} />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">My wishlist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {items.length === 0
            ? "Saved products appear here and sync to your account when you sign in."
            : `${items.length} saved product${items.length === 1 ? "" : "s"}.`}
        </p>

        {items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Heart className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-semibold text-foreground">Nothing saved yet</p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Discover products
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <Link to="/products/$id" params={{ id: item.id }}>
                  <img
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    className="h-40 w-full object-cover"
                  />
                </Link>
                <div className="space-y-2 p-4">
                  <Link
                    to="/products/$id"
                    params={{ id: item.id }}
                    className="line-clamp-2 text-sm font-medium text-foreground hover:text-primary"
                  >
                    {item.title}
                  </Link>
                  <p className="text-sm font-bold text-primary">{item.price}</p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        addToCart({
                          id: item.id,
                          title: item.title,
                          price: item.price,
                          image: item.image,
                        });
                        toast.success("Added to cart");
                      }}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Add to cart
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${item.title} from wishlist`}
                      onClick={() => {
                        removeFromWishlist(item.id);
                        toast("Removed from wishlist");
                      }}
                      className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground hover:border-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Footer />
    </div>
  );
}
