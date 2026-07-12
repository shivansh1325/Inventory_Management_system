"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { productSchema, UNITS, type ProductInput } from "@/lib/validation";
import { saveProduct } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label, FieldError } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function NewProductButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add product
      </Button>
      {open && <ProductFormDialog product={null} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ProductFormDialog({
  product,
  onClose,
}: {
  product: { id: string; sku: string; name: string; description: string | null; unit: string } | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          sku: product.sku,
          name: product.name,
          description: product.description ?? "",
          unit: product.unit as ProductInput["unit"],
        }
      : { unit: "pcs", description: "" },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
        <DialogDescription>After saving, open the product to define its Bill of Materials.</DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={handleSubmit((data) =>
            startTransition(async () => {
              const res = await saveProduct(product?.id ?? null, data);
              if (!res.ok) setServerError(res.error ?? "Failed");
              else onClose();
            }),
          )}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>SKU *</Label>
              <Input {...register("sku")} placeholder="PRD-CTRL-PANEL" />
              <FieldError message={errors.sku?.message} />
            </div>
            <div className="space-y-1">
              <Label>Unit</Label>
              <Select {...register("unit")}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input {...register("name")} placeholder="Control Panel" />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea {...register("description")} />
          </div>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
