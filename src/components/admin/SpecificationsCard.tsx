import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { WARRANTY_OPTIONS, newId, type AdminProduct, type CustomAttribute, type WarrantyStatus } from "@/lib/admin-store";

const baseInput =
  "h-9 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";
const inputClass = `${baseInput} border-border`;
const errorInput = `${baseInput} border-destructive`;

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <span role="alert" className="mt-1 block text-xs text-destructive">
      {children}
    </span>
  );
}

type Props = {
  form: AdminProduct;
  set: <K extends keyof AdminProduct>(key: K, value: AdminProduct[K]) => void;
  errors?: Record<string, string>;
};

/** Brand, sizes, warranty and free-form key/value attributes. */
export default function SpecificationsCard({ form, set, errors = {} }: Props) {
  const [sizeDraft, setSizeDraft] = useState("");
  const [sizeError, setSizeError] = useState("");

  function addSize() {
    const value = sizeDraft.trim();
    if (!value) {
      setSizeError("Type a size before adding it");
      return;
    }
    if (value.length > 20) {
      setSizeError("Each size must be 20 characters or fewer");
      return;
    }
    if (form.sizeOptions.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setSizeError(`“${value}” has already been added`);
      return;
    }
    if (form.sizeOptions.length >= 30) {
      setSizeError("You can add at most 30 size options");
      return;
    }
    setSizeError("");
    set("sizeOptions", [...form.sizeOptions, value]);
    setSizeDraft("");
  }

  function updateAttr(id: string, patch: Partial<CustomAttribute>) {
    set(
      "customAttributes",
      form.customAttributes.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
  }

  const sizeMessage = sizeError || errors.sizeOptions || "";
  const warrantyRequired = form.warrantyStatus !== "none";

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Product specifications</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Brand, sizing, warranty and any extra attributes for this item type.
        </p>
      </header>

      <div className="space-y-4 p-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-foreground">Brand</span>
          <input
            value={form.brand}
            onChange={(e) => set("brand", e.target.value)}
            placeholder="e.g. Aurora, Uniqlo, ASUS"
            className={inputClass}
          />
        </label>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-foreground">Size options</span>
          <div className="flex gap-2">
            <input
              value={sizeDraft}
              aria-invalid={sizeMessage ? true : undefined}
              onChange={(e) => {
                setSizeDraft(e.target.value);
                if (sizeError) setSizeError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addSize();
                }
              }}
              placeholder="Type a size (S, M, XL, 42, 30x40cm) and press Enter"
              className={sizeMessage ? errorInput : inputClass}
            />
            <button
              type="button"
              onClick={addSize}
              className="h-9 shrink-0 rounded-lg border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              Add
            </button>
          </div>
          {sizeMessage ? (
            <ErrorText>{sizeMessage}</ErrorText>
          ) : (
            <span className="mt-1 block text-xs text-muted-foreground">
              Optional. Up to 30 sizes, 20 characters each.
            </span>
          )}
          {form.sizeOptions.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {form.sizeOptions.map((size) => (
                <li key={size}>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                    {size}
                    <button
                      type="button"
                      aria-label={`Remove size ${size}`}
                      onClick={() => {
                        setSizeError("");
                        set(
                          "sizeOptions",
                          form.sizeOptions.filter((s) => s !== size),
                        );
                      }}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">Warranty status</span>
            <select
              value={form.warrantyStatus}
              onChange={(e) => set("warrantyStatus", e.target.value as WarrantyStatus)}
              className={inputClass}
            >
              {WARRANTY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">
              Warranty duration{warrantyRequired && <span className="text-destructive"> *</span>}
            </span>
            <input
              value={form.warrantyDuration}
              onChange={(e) => set("warrantyDuration", e.target.value)}
              disabled={form.warrantyStatus === "none"}
              aria-invalid={errors.warrantyDuration ? true : undefined}
              placeholder="e.g. 1 Year"
              className={`${errors.warrantyDuration ? errorInput : inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
            />
            {errors.warrantyDuration ? (
              <ErrorText>{errors.warrantyDuration}</ErrorText>
            ) : (
              warrantyRequired && (
                <span className="mt-1 block text-xs text-muted-foreground">
                  Format: number + unit, e.g. “6 Months”.
                </span>
              )
            )}
          </label>
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Custom attributes</span>
            <button
              type="button"
              onClick={() =>
                set("customAttributes", [
                  ...form.customAttributes,
                  { id: newId(), key: "", value: "" },
                ])
              }
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" /> Add custom attribute
            </button>
          </div>

          {form.customAttributes.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Add pairs like “RAM / 16GB” or “Material / Cotton”.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {form.customAttributes.map((attr) => {
                const keyError = errors[`attr.${attr.id}.key`];
                const valueError = errors[`attr.${attr.id}.value`];
                return (
                  <li key={attr.id} className="flex gap-2">
                    <div className="flex-1">
                      <input
                        value={attr.key}
                        onChange={(e) => updateAttr(attr.id, { key: e.target.value })}
                        aria-label="Attribute name"
                        aria-invalid={keyError ? true : undefined}
                        placeholder="Attribute (e.g. RAM)"
                        className={keyError ? errorInput : inputClass}
                      />
                      {keyError && <ErrorText>{keyError}</ErrorText>}
                    </div>
                    <div className="flex-1">
                      <input
                        value={attr.value}
                        onChange={(e) => updateAttr(attr.id, { value: e.target.value })}
                        aria-label="Attribute value"
                        aria-invalid={valueError ? true : undefined}
                        placeholder="Value (e.g. 16GB)"
                        className={valueError ? errorInput : inputClass}
                      />
                      {valueError && <ErrorText>{valueError}</ErrorText>}
                    </div>
                    <button
                      type="button"
                      aria-label="Remove attribute"
                      onClick={() =>
                        set(
                          "customAttributes",
                          form.customAttributes.filter((a) => a.id !== attr.id),
                        )
                      }
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
