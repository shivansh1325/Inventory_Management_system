"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { transferStockAction } from "@/lib/transfer-actions";
import { fmtQty } from "@/lib/qty";
import { Button } from "@/components/ui/button";
import { Input, Select, Label, FieldError } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

type ComponentOpt = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  levels: Record<string, number>;
};
type WarehouseOpt = { id: string; name: string; isDefault: boolean };

export function TransferForm({
  components,
  warehouses,
}: {
  components: ComponentOpt[];
  warehouses: WarehouseOpt[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [componentId, setComponentId] = useState("");
  const [from, setFrom] = useState(warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? "");
  const [to, setTo] = useState(warehouses.find((w) => w.id !== from)?.id ?? "");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const component = components.find((c) => c.id === componentId);
  const availableAtFrom = useMemo(
    () => (component ? (component.levels[from] ?? 0) : 0),
    [component, from],
  );

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await transferStockAction({
        componentId,
        fromWarehouseId: from,
        toWarehouseId: to,
        qty: qty.trim(),
        note,
      });
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        toast.success("Transfer recorded");
        setQty("");
        setNote("");
        router.refresh();
      }
    });
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-primary dark:text-indigo-300" /> New transfer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label>Component *</Label>
          <Select value={componentId} onChange={(e) => setComponentId(e.target.value)}>
            <option value="">— select —</option>
            {components.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.sku})</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>From *</Label>
            <Select value={from} onChange={(e) => setFrom(e.target.value)}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>To *</Label>
            <Select value={to} onChange={(e) => setTo(e.target.value)}>
              {warehouses
                .filter((w) => w.id !== from)
                .map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
            </Select>
          </div>
        </div>
        {component && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Available at source: <b className="tabular-nums">{fmtQty(availableAtFrom)} {component.unit}</b>
          </p>
        )}
        <div className="space-y-1">
          <Label>Quantity{component ? ` (${component.unit})` : ""} *</Label>
          <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
        </div>
        <div className="space-y-1">
          <Label>Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / reference" />
        </div>
        <FieldError message={error ?? undefined} />
        <Button
          className="w-full"
          disabled={pending || !componentId || !qty.trim() || from === to}
          onClick={submit}
        >
          {pending ? "Transferring…" : "Transfer"}
        </Button>
      </CardContent>
    </Card>
  );
}
