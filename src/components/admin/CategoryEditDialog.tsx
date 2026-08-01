import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  categoryKey,
  normalizeCategoryName,
  useUpdateCategory,
  type ProductStatus,
} from "@/lib/admin-store";

import { GROUP_NAMES, useCategoryOverrides } from "@/lib/category-overrides";

export type CategoryEditTarget = {
  name: string;
  group: string;
  total: number;
  active: number;
};

type StatusChoice = ProductStatus | "keep";

type FieldErrors = { name?: string; group?: string; form?: string };

const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} '&/+-]*$/u;

function buildSchema(existingNames: string[], currentName: string) {
  const taken = existingNames
    .filter((n) => categoryKey(n) !== categoryKey(currentName))
    .map((n) => categoryKey(n));

  return z.object({
    name: z
      .string()
      .trim()
      .min(2, "Category name must be at least 2 characters.")
      .max(60, "Category name must be 60 characters or fewer.")
      .regex(NAME_PATTERN, "Use letters, numbers, spaces and - & / + ' only.")
      .refine(
        (v) => !taken.includes(categoryKey(v)),
        "Another category already uses this name (names ignore capitalisation and extra spaces).",
      ),

    group: z
      .string()
      .refine((v) => GROUP_NAMES.includes(v), "Choose a valid group mapping."),
  });
}

export function CategoryEditDialog({
  target,
  existingNames = [],
  onOpenChange,
}: {
  target: CategoryEditTarget | null;
  existingNames?: string[];
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState(GROUP_NAMES[0]);
  const [status, setStatus] = useState<StatusChoice>("keep");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { renameCategory } = useCategoryOverrides();
  const update = useUpdateCategory();

  const normalizedName = useMemo(() => normalizeCategoryName(name), [name]);
  const normalizedHint = useMemo(() => {
    const raw = name;
    const norm = normalizedName;
    if (!raw || !norm) return null;
    if (raw === norm) return null;
    const reasons: string[] = [];
    if (raw.trim() !== raw) reasons.push("trimmed");
    if (raw.localeCompare(norm, undefined, { sensitivity: "base" }) !== 0) {
      reasons.push("case-normalized");
    }
    if (categoryKey(raw) !== categoryKey(norm)) {
      reasons.push("extra spaces removed");
    }
    return { norm, reasons };
  }, [name, normalizedName]);

  useEffect(() => {
    if (!target) return;
    setName(target.name);
    setGroup(GROUP_NAMES.includes(target.group) ? target.group : GROUP_NAMES[0]);
    setStatus("keep");
    setErrors({});
    setTouched(false);
  }, [target]);

  function validate(next: { name: string; group: string }): FieldErrors {
    if (!target) return {};
    const result = buildSchema(existingNames, target.name).safeParse(next);
    if (result.success) return {};
    const found: FieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof FieldErrors;
      if (!found[key]) found[key] = issue.message;
    }
    return found;
  }

  function revalidate(next: { name?: string; group?: string }) {
    if (!touched) return;
    setErrors(validate({ name: next.name ?? name, group: next.group ?? group }));
  }

  async function save() {
    if (!target || isSaving) return;
    setTouched(true);
    const found = validate({ name, group });
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});
    const trimmed = normalizeCategoryName(name);
    setIsSaving(true);
    try {
      await update.mutateAsync({
        from: target.name,
        to: trimmed,
        status: status === "keep" ? null : status,
      });
      renameCategory(target.name, trimmed, group);
      toast.success("Category updated", {
        description: `${trimmed} · ${group}${
          status === "keep" ? "" : ` · all products set to ${status}`
        }`,
      });
      onOpenChange(false);
    } catch (e) {
      setErrors({
        form: e instanceof Error ? e.message : "Could not update this category.",
      });
    } finally {
      setIsSaving(false);
    }
  }


  const saving = isSaving || update.isPending;

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(open) => {
        if (!open && saving) return;
        onOpenChange(open);
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        closeDisabled={saving}
        onPointerDownOutside={(e) => {
          if (saving) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (saving) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Edit category</DialogTitle>
          <DialogDescription>
            {target
              ? `${target.total} product${target.total === 1 ? "" : "s"} use this category.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              maxLength={60}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "category-name-error" : "category-name-hint"}
              onChange={(e) => {
                setName(e.target.value);
                revalidate({ name: e.target.value });
              }}
              onBlur={() => {
                setTouched(true);
                setErrors(validate({ name, group }));
              }}
              className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
              placeholder="e.g. Women's Clothing"
            />
            {errors.name ? (
              <p
                id="category-name-error"
                className="flex items-center gap-1.5 text-xs font-medium text-destructive"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {errors.name}
              </p>
            ) : normalizedHint ? (
              <p
                id="category-name-hint"
                className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400"
              >
                <Info className="h-3.5 w-3.5 shrink-0" />
                Will be saved as <span className="font-semibold">“{normalizedHint.norm}”</span>
                {normalizedHint.reasons.length > 0 && ` (${normalizedHint.reasons.join(", ")})`}
              </p>
            ) : (
              <p id="category-name-hint" className="text-xs text-muted-foreground">
                Renaming updates every product currently in this category.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category-status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusChoice)}>
              <SelectTrigger id="category-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">Keep current product statuses</SelectItem>
                <SelectItem value="active">Set all products active</SelectItem>
                <SelectItem value="draft">Set all products draft</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category-group">Mapping</Label>
            <Select
              value={group}
              onValueChange={(v) => {
                setGroup(v);
                revalidate({ group: v });
              }}
            >
              <SelectTrigger
                id="category-group"
                aria-invalid={Boolean(errors.group)}
                aria-describedby={errors.group ? "category-group-error" : undefined}
                className={errors.group ? "border-destructive focus:ring-destructive" : ""}
              >
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {GROUP_NAMES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.group && (
              <p
                id="category-group-error"
                className="flex items-center gap-1.5 text-xs font-medium text-destructive"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {errors.group}
              </p>
            )}
          </div>

          {errors.form && (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {errors.form}
            </p>
          )}
        </div>


        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving || update.isPending}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={
              isSaving ||
              update.isPending ||
              Object.keys(validate({ name, group })).length > 0
            }
          >
            {(isSaving || update.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
