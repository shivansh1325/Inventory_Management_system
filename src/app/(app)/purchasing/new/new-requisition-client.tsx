"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Send, Save } from "lucide-react";
import { createRequisitionAction } from "@/lib/purchasing-actions";
import { fmtQty, fmtMoney, mulQty, toMilli } from "@/lib/qty";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label, FieldError } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

type ComponentOpt = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  stockQty: number;
  minLevel: number;
  unitCost: number | null;
};

type Line = { componentId: string; qty: string };
const QTY_RE = /^\d+(\.\d{1,3})?$/;

export function NewRequisitionClient({
  components,
  warehouses,
  suppliers,
  initialComponentId,
}: {
  components: ComponentOpt[];
  warehouses: { id: string; name: string; isDefault: boolean }[];
  suppliers: { id: string; name: string }[];
  initialComponentId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? "",
  );
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>(
    initialComponentId && components.some((c) => c.id === initialComponentId)
      ? [{ componentId: initialComponentId, qty: "" }]
      : [{ componentId: "", qty: "" }],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(components.map((c) => [c.id, c])), [components]);

  const estValue = lines.reduce((sum, l) => {
    const c = byId.get(l.componentId);
    if (!c || c.unitCost == null || !QTY_RE.test(l.qty.trim()) || parseFloat(l.qty) <= 0) return sum;
    return sum + mulQty(toMilli(l.qty.trim()), c.unitCost);
  }, 0);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const save = (submit: boolean) => {
    setError(null);
    const clean = lines.filter((l) => l.componentId && l.qty.trim());
    if (clean.length === 0) return setError("Add at least one line with a component and quantity");
    startTransition(async () => {
      const res = await createRequisitionAction({
        warehouseId,
        supplierId,
        note,
        submit,
        lines: clean,
      });
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        toast.success(`${res.prNo} ${submit ? "submitted for approval" : "saved as draft"}`);
        router.push(`/purchasing/${res.requisitionId}`);
      }
    });
  };

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Deliver to warehouse *</Label>
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Supplier (optional)</Label>
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">— none —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-3">
            <Label>Note</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why is this needed?" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lines</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {lines.map((l, i) => {
            const c = byId.get(l.componentId);
            return (
              <div key={i} className="flex flex-wrap items-end gap-3 rounded-md bg-slate-50 p-3">
                <div className="min-w-56 flex-1 space-y-1">
                  <Label>Component</Label>
                  <Select value={l.componentId} onChange={(e) => setLine(i, { componentId: e.target.value })}>
                    <option value="">— select —</option>
                    {components.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.sku})</option>
                    ))}
                  </Select>
                </div>
                <div className="w-36 space-y-1">
                  <Label>Qty{c ? ` (${c.unit})` : ""}</Label>
                  <Input value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} inputMode="decimal" />
                </div>
                {c && (
                  <div className="pb-2 text-xs text-slate-500">
                    stock {fmtQty(c.stockQty)} / min {fmtQty(c.minLevel)}
                    {c.unitCost != null && ` · ${fmtMoney(c.unitCost)}/${c.unit}`}
                  </div>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                  disabled={lines.length === 1}
                  aria-label="Remove line"
                >
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            );
          })}
          <Button variant="secondary" size="sm" onClick={() => setLines((ls) => [...ls, { componentId: "", qty: "" }])}>
            <Plus className="h-3.5 w-3.5" /> Add line
          </Button>
          <div className="flex justify-end border-t border-slate-100 pt-3 text-sm">
            <span className="text-slate-500">Estimated value:&nbsp;</span>
            <span className="font-semibold tabular-nums">{estValue > 0 ? fmtMoney(estValue) : "—"}</span>
          </div>
        </CardContent>
      </Card>

      <FieldError message={error ?? undefined} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={pending} onClick={() => save(false)}>
          <Save className="h-4 w-4" /> Save draft
        </Button>
        <Button disabled={pending} onClick={() => save(true)}>
          <Send className="h-4 w-4" /> {pending ? "Saving…" : "Submit for approval"}
        </Button>
      </div>
    </div>
  );
}
