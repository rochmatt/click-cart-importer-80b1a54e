import { useCatalog } from "@/lib/catalog";
import { ProductCard } from "./ProductCard";

export function RelatedProducts({ currentId }: { currentId: string }) {
  const { products } = useCatalog();
  const related = products.filter((p) => p.id !== currentId).slice(0, 4);

  if (related.length === 0) return null;

  return (
    <section className="mt-10 sm:mt-14">
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          You may also like
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Popular picks other shoppers compared with this product.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
        {related.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
