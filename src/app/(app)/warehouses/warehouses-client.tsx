"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Star, Warehouse as WarehouseIcon } from "lucide-react";
import { saveWarehouse, setDefaultWarehouseAction } from "@/lib/admin-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

type Row = {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  itemCount: number;
};

export function WarehousesClient({ warehouses }: { warehouses: Row[] }) {
  const toast = useToast();
  const [editing, setEditing] = useState<Row | null | "new">(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Add warehouse
        </Button>
      </div>
      {warehouses.length === 0 ? (
        <Card>
          <EmptyState icon={WarehouseIcon} title="No warehouses" description="Run the seed or add one." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((w) => (
            <Card key={w.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary dark:text-slate-800">
                    <WarehouseIcon className="h-4 w-4" />
                  </div>
                  <div className="flex gap-1.5">
                    {w.isDefault && <Badge tone="info">default</Badge>}
                    {!w.isActive && <Badge tone="out">inactive</Badge>}
                  </div>
                </div>
                <div className="mt-2 font-semibold text-slate-900">{w.name}</div>
                <div className="font-mono text-xs text-slate-400">{w.code}</div>
                <div className="mt-1 text-xs text-slate-500">{w.itemCount} stocked component{w.itemCount === 1 ? "" : "s"}</div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(w)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  {!w.isDefault && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      title="Make this the default warehouse for receipts and runs"
                      onClick={() =>
                        startTransition(async () => {
                          const res = await setDefaultWarehouseAction(w.id);
                          if (!res.ok) toast.error(res.error ?? "Failed");
                          else toast.success(`${w.name} is now the default`);
                        })
                      }
                    >
                      <Star className="h-3.5 w-3.5" /> Set default
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing !== null && (
        <WarehouseFormDialog wh={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function WarehouseFormDialog({ wh, onClose }: { wh: Row | null; onClose: () => void }) {
  const toast = useToast();
  const [code, setCode] = useState(wh?.code ?? "");
  const [name, setName] = useState(wh?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogTitle>{wh ? "Edit warehouse" : "Add warehouse"}</DialogTitle>
        <DialogDescription>Transfers move stock between warehouses; each movement records its location.</DialogDescription>
        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label>Code * (short, unique)</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WH2" />
          </div>
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Assembly Floor Store" />
          </div>
          <FieldError message={error ?? undefined} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await saveWarehouse(wh?.id ?? null, { code, name });
                  if (!res.ok) setError(res.error ?? "Failed");
                  else {
                    toast.success(wh ? "Warehouse updated" : "Warehouse created");
                    onClose();
                  }
                })
              }
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
