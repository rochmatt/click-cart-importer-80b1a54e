import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type Address,
  deleteMyAddress,
  listMyAddresses,
  saveMyAddress,
  setDefaultAddress,
} from "@/lib/addresses.functions";

const empty = {
  label: "Home",
  recipient_name: "",
  phone: "",
  address_line: "",
  city: "",
  province: "",
  postal_code: "",
  notes: "",
  is_default: false,
};

type Draft = typeof empty & { id?: string };

export function AddressBook() {
  const queryClient = useQueryClient();
  const fetchAddresses = useServerFn(listMyAddresses);
  const save = useServerFn(saveMyAddress);
  const remove = useServerFn(deleteMyAddress);
  const makeDefault = useServerFn(setDefaultAddress);

  const [draft, setDraft] = useState<Draft | null>(null);

  const addressesQuery = useQuery({
    queryKey: ["account", "addresses"],
    queryFn: () => fetchAddresses(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["account", "addresses"] });

  const saveMutation = useMutation({
    mutationFn: (input: Draft) => save({ data: input }),
    onSuccess: () => {
      setDraft(null);
      invalidate();
      toast.success("Address saved");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Could not save the address"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Address removed");
    },
    onError: () => toast.error("Could not remove the address"),
  });

  const defaultMutation = useMutation({
    mutationFn: (id: string) => makeDefault({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Default shipping address updated");
    },
    onError: () => toast.error("Could not update the default address"),
  });

  const addresses = addressesQuery.data ?? [];

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            Address book
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved addresses are used to prefill checkout.
          </p>
        </div>
        {!draft && (
          <button
            type="button"
            onClick={() => setDraft({ ...empty, is_default: addresses.length === 0 })}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add address
          </button>
        )}
      </div>

      {draft && (
        <form
          className="mt-5 space-y-3 rounded-xl border border-border bg-secondary/40 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate(draft);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Label" value={draft.label} onChange={(v) => setDraft({ ...draft, label: v })} placeholder="Home / Office" />
            <Field label="Recipient name" value={draft.recipient_name} onChange={(v) => setDraft({ ...draft, recipient_name: v })} placeholder="Budi Santoso" />
            <Field label="Phone" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} placeholder="+62 812 3456 7890" />
            <Field label="City" value={draft.city} onChange={(v) => setDraft({ ...draft, city: v })} placeholder="Jakarta Selatan" />
            <Field label="Province" value={draft.province} onChange={(v) => setDraft({ ...draft, province: v })} placeholder="DKI Jakarta" />
            <Field label="Postal code" value={draft.postal_code} onChange={(v) => setDraft({ ...draft, postal_code: v })} placeholder="12345" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address-line">Street address</Label>
            <Textarea
              id="address-line"
              value={draft.address_line}
              onChange={(e) => setDraft({ ...draft, address_line: e.target.value })}
              placeholder="Jl. Melati No. 12, RT 03 / RW 05"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address-notes">Courier notes (optional)</Label>
            <Input
              id="address-notes"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Leave with the front desk"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-foreground">
            <input
              type="checkbox"
              checked={draft.is_default}
              onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            Use as default shipping address
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save address
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {addressesQuery.isLoading ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading addresses…
        </p>
      ) : addresses.length === 0 && !draft ? (
        <p className="mt-5 text-sm text-muted-foreground">
          No saved addresses yet. Add one to speed up checkout.
        </p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {addresses.map((address: Address) => (
            <li key={address.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                    {address.label}
                    {address.is_default && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Default
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs font-medium text-foreground">
                    {address.recipient_name} · {address.phone}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {address.address_line}
                    {address.city ? `, ${address.city}` : ""}
                    {address.province ? `, ${address.province}` : ""}
                    {address.postal_code ? ` ${address.postal_code}` : ""}
                  </p>
                  {address.notes && (
                    <p className="mt-1 text-xs italic text-muted-foreground">{address.notes}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton
                    label="Edit address"
                    onClick={() => setDraft({ ...address })}
                    icon={<Pencil className="h-3.5 w-3.5" />}
                  />
                  <IconButton
                    label="Delete address"
                    onClick={() => removeMutation.mutate(address.id)}
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                  />
                </div>
              </div>
              {!address.is_default && (
                <button
                  type="button"
                  onClick={() => defaultMutation.mutate(address.id)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <Star className="h-3.5 w-3.5" />
                  Set as default
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function IconButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
    >
      {icon}
    </button>
  );
}
