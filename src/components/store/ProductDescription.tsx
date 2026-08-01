import { Check, Info } from "lucide-react";

interface ProductDescriptionProps {
  description: string;
  specs: string[];
  detailedSpecs?: { label: string; value: string }[];
}

export function ProductDescription({
  description,
  specs,
  detailedSpecs,
}: ProductDescriptionProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Description
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">{description}</p>

          <div className="mt-8">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Highlights
            </h3>
            <ul className="mt-3 space-y-2.5">
              {specs.map((spec, index) => (
                <li key={index} className="flex items-start gap-2.5 text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{spec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Detailed Specifications
            </h2>
            <Info className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>

          {detailedSpecs && detailedSpecs.length > 0 ? (
            <dl className="mt-4 divide-y divide-border rounded-xl border border-border bg-background">
              {detailedSpecs.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[180px_1fr] sm:gap-4"
                >
                  <dt className="text-sm font-medium text-muted-foreground">{item.label}</dt>
                  <dd className="text-sm font-semibold text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {specs.map((spec, index) => (
                <li key={index} className="flex items-start gap-2.5 text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{spec}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
