"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductFormDialog } from "../product-form";

export function EditProductButton({
  product,
}: {
  product: { id: string; sku: string; name: string; description: string | null; unit: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" /> Edit
      </Button>
      {open && <ProductFormDialog product={product} onClose={() => setOpen(false)} />}
    </>
  );
}
