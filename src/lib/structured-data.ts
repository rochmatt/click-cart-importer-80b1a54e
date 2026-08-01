import type { Product } from "@/data/products";
import type { ProductReview } from "@/data/reviews";

/**
 * schema.org helpers for rich results. Every builder returns a plain object
 * that route `head().scripts` can stringify into an `application/ld+json` tag.
 *
 * URLs stay relative-friendly: no project domain is configured yet, so we emit
 * site-relative `@id`/`url` values which crawlers resolve against the host.
 */

export const SITE_NAME = "PasarPilih";
const SITE_DESCRIPTION =
  "Compare flash sale prices, claim vouchers and track orders across Shopee, Tokopedia and TikTok Shop in one curated storefront.";

type JsonLd = Record<string, unknown>;

/** Turns a rupiah display string such as "Rp 549.000" into "549000". */
export function priceAmount(price: string): string | undefined {
  const digits = price.replace(/[^\d]/g, "");
  return digits.length > 0 ? digits : undefined;
}

export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "/#organization",
    name: SITE_NAME,
    url: "/",
    description: SITE_DESCRIPTION,
    logo: { "@type": "ImageObject", url: "/favicon.ico" },
    areaServed: { "@type": "Country", name: "Indonesia" },
  };
}

export function webSiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "/#website",
    name: SITE_NAME,
    url: "/",
    description: SITE_DESCRIPTION,
    publisher: { "@id": "/#organization" },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "/search?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.path,
    })),
  };
}

/** Individual customer review, nested inside the Product node. */
export function reviewJsonLd(review: ProductReview): JsonLd {
  return {
    "@type": "Review",
    name: review.title,
    reviewBody: review.body,
    datePublished: review.date,
    author: { "@type": "Person", name: review.author },
    reviewRating: {
      "@type": "Rating",
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1,
    },
  };
}

export function productJsonLd(
  product: Product,
  path: string,
  reviews: ProductReview[] = [],
): JsonLd {
  const amount = priceAmount(product.price);
  const offers: JsonLd[] = [
    {
      "@type": "Offer",
      url: path,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      ...(amount ? { price: amount, priceCurrency: "IDR" } : {}),
      seller: { "@id": "/#organization" },
    },
  ];

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${path}#product`,
    name: product.title,
    description: product.description,
    image: product.images,
    category: product.category,
    url: path,
    brand: { "@type": "Brand", name: SITE_NAME },
    ...(product.reviews > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviews,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    offers: offers.length === 1 ? offers[0] : offers,
  };
}

/** Wraps a schema object into the shape TanStack `head().scripts` expects. */
export function jsonLdScript(data: JsonLd) {
  return {
    type: "application/ld+json" as const,
    children: JSON.stringify(data),
  };
}

export function itemListJsonLd(
  name: string,
  products: { id: string; title: string }[],
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: product.title,
      url: `/products/${product.id}`,
    })),
  };
}
