export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-[var(--shadow-card)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary animate-pulse sm:max-h-52 lg:max-h-48" />
      <div className="flex flex-1 flex-col gap-3 p-3.5 sm:p-4">
        <div className="h-4 w-3/4 rounded bg-secondary animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-secondary animate-pulse" />
        <div className="mt-auto h-5 w-1/3 rounded bg-secondary animate-pulse" />
        <div className="h-8 w-full rounded-full bg-secondary animate-pulse" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5 lg:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
