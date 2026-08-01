import { Star } from "lucide-react";
import type { ProductReview } from "@/data/reviews";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i <= rating ? "fill-chart-4 text-chart-4" : "text-muted-foreground/40"
          }`}
        />
      ))}
    </span>
  );
}

export function ProductReviews({ reviews }: { reviews: ProductReview[] }) {
  if (reviews.length === 0) return null;

  return (
    <section className="mt-10 sm:mt-14">
      <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        Customer reviews
      </h2>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <Stars rating={review.rating} />
              <time
                dateTime={review.date}
                className="text-xs text-muted-foreground"
              >
                {new Date(review.date).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </time>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">{review.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {review.body}
            </p>
            <p className="mt-3 text-xs font-medium text-foreground">{review.author}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
