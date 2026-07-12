"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Truck } from "lucide-react";
import { saveSupplier } from "@/lib/admin-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

type Supplier = {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  terms: string | null;
  leadTimeDays: number | null;
};

export function SuppliersSection({ suppliers, canEdit }: { suppliers: Supplier[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<Supplier | null | "new">(null);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary dark:text-indigo-300" /> Suppliers
          </CardTitle>
          <CardDescription>Master data used on requisitions</CardDescription>
        </div>
        {canEdit && (
          <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-3.5 w-3.5" /> Add supplier
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {suppliers.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No suppliers yet.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Contact</TH>
                <TH>Email / phone</TH>
                <TH>Terms</TH>
                <TH className="text-right">Lead time</TH>
                {canEdit && <TH className="text-right" />}
              </TR>
            </THead>
            <TBody>
              {suppliers.map((s) => (
                <TR key={s.id}>
                  <TD className="font-medium">{s.name}</TD>
                  <TD className="text-slate-500">{s.contact ?? "—"}</TD>
                  <TD className="text-xs text-slate-500">
                    {s.email ?? ""}{s.email && s.phone ? " · " : ""}{s.phone ?? ""}
                    {!s.email && !s.phone && "—"}
                  </TD>
                  <TD className="text-xs text-slate-500">{s.terms ?? "—"}</TD>
                  <TD className="text-right tabular-nums text-slate-500">
                    {s.leadTimeDays != null ? `${s.leadTimeDays} d` : "—"}
                  </TD>
                  {canEdit && (
                    <TD className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(s)} aria-label="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>
      {editing !== null && (
        <SupplierDialog supplier={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </Card>
  );
}

function SupplierDialog({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({
    name: supplier?.name ?? "",
    contact: supplier?.contact ?? "",
    email: supplier?.email ?? "",
    phone: supplier?.phone ?? "",
    terms: supplier?.terms ?? "",
    leadTimeDays: supplier?.leadTimeDays != null ? String(supplier.leadTimeDays) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((x) => ({ ...x, [k]: e.target.value }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{supplier ? "Edit supplier" : "Add supplier"}</DialogTitle>
        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={v.name} onChange={set("name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Contact person</Label>
              <Input value={v.contact} onChange={set("contact")} />
            </div>
            <div className="space-y-1">
              <Label>Lead time (days)</Label>
              <Input value={v.leadTimeDays} onChange={set("leadTimeDays")} inputMode="numeric" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={v.email} onChange={set("email")} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={v.phone} onChange={set("phone")} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Terms</Label>
            <Input value={v.terms} onChange={set("terms")} placeholder="Net 30…" />
          </div>
          <FieldError message={error ?? undefined} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await saveSupplier(supplier?.id ?? null, v);
                  if (!res.ok) setError(res.error ?? "Failed");
                  else {
                    toast.success(supplier ? "Supplier updated" : "Supplier added");
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
