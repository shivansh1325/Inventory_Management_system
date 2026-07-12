"use client";

import { useMemo, useState, useTransition } from "react";
import { Trash2, Check, Pencil } from "lucide-react";
import { addBomItem, updateBomItem, removeBomItem } from "@/lib/actions";
import { fmtQty, fmtMoney, mulQty, toMilli } from "@/lib/qty";
import { Button } from "@/components/ui/button";
import { Input, Select, Label, FieldError } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type BomRow = {
  id: string;
  componentId: string;
  qtyPerUnit: number; // milli
  sku: string;
  name: string;
  unit: string;
  stockQty: number;
  unitCost: number | null;
};

type ComponentOption = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  stockQty: number;
  unitCost: number | null;
};

const QTY_RE = /^\d+(\.\d{1,3})?$/;

export function BomEditor({
  productId,
  bom,
  components,
  readOnly,
}: {
  productId: string;
  bom: BomRow[];
  components: ComponentOption[];
  readOnly?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [componentId, setComponentId] = useState("");
  const [qty, setQty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const usedIds = useMemo(() => new Set(bom.map((b) => b.componentId)), [bom]);
  const options = useMemo(() => {
    const q = search.trim().toLowerCase();
    return components
      .filter((c) => !usedIds.has(c.id))
      .filter((c) => !q || `${c.sku} ${c.name}`.toLowerCase().includes(q));
  }, [components, usedIds, search]);

  const selected = components.find((c) => c.id === componentId);

  const totalCost = bom.reduce(
    (sum, b) => sum + (b.unitCost != null ? mulQty(b.qtyPerUnit, b.unitCost) : 0),
    0,
  );

  const add = () => {
    setError(null);
    if (!componentId) return setError("Pick a component");
    if (!QTY_RE.test(qty.trim()) || parseFloat(qty) <= 0)
      return setError("Quantity per unit must be > 0 (max 3 decimals)");
    startTransition(async () => {
      const res = await addBomItem({ productId, componentId, qtyPerUnit: qty.trim() });
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        setComponentId("");
        setQty("");
        setSearch("");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bill of Materials — per 1 unit</CardTitle>
        <CardDescription>
          Components and exact quantities needed to build one unit. Past production runs keep
          their own snapshot — editing this list only affects future runs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && (
        <div className="flex flex-wrap items-end gap-3 rounded-md bg-slate-50 p-3">
          <div className="w-52 space-y-1">
            <Label>Search components</Label>
            <Input
              placeholder="Filter by SKU / name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-64 space-y-1">
            <Label>Component</Label>
            <Select value={componentId} onChange={(e) => setComponentId(e.target.value)}>
              <option value="">— select ({options.length}) —</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.sku})
                </option>
              ))}
            </Select>
          </div>
          <div className="w-40 space-y-1">
            <Label>Qty per unit{selected ? ` (${selected.unit})` : ""}</Label>
            <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" placeholder="e.g. 2.5" />
          </div>
          <Button onClick={add} disabled={pending}>Add line</Button>
          {error && <FieldError message={error} />}
        </div>
        )}

        <Table>
          <THead>
            <TR>
              <TH>Component</TH>
              <TH className="text-right">Qty / unit</TH>
              <TH className="text-right">In stock</TH>
              <TH className="text-right">Line cost / unit</TH>
              {!readOnly && <TH className="text-right">Actions</TH>}
            </TR>
          </THead>
          <TBody>
            {bom.length === 0 ? (
              <TR>
                <TD colSpan={5} className="py-8 text-center text-slate-400">
                  No BOM lines yet — the product cannot be produced until it has at least one.
                </TD>
              </TR>
            ) : (
              bom.map((b) => <BomLine key={b.id} line={b} readOnly={readOnly} />)
            )}
          </TBody>
        </Table>

        <div className="flex justify-end border-t border-slate-100 pt-3 text-sm">
          <span className="text-slate-500">Estimated material cost per unit:&nbsp;</span>
          <span className="font-semibold tabular-nums">{totalCost > 0 ? fmtMoney(totalCost) : "—"}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function BomLine({ line, readOnly }: { line: BomRow; readOnly?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(fmtQty(line.qtyPerUnit));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const lineCost = line.unitCost != null ? mulQty(line.qtyPerUnit, line.unitCost) : null;

  const save = () =>
    startTransition(async () => {
      const res = await updateBomItem(line.id, value);
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        setError(null);
        setEditing(false);
      }
    });

  const remove = () => {
    if (!confirm(`Remove ${line.name} from this BOM?`)) return;
    startTransition(async () => {
      await removeBomItem(line.id);
    });
  };

  return (
    <TR>
      <TD>
        <div className="font-medium">{line.name}</div>
        <div className="font-mono text-xs text-slate-400">{line.sku}</div>
      </TD>
      <TD className="text-right tabular-nums">
        {editing ? (
          <span className="inline-flex items-center gap-1">
            <Input className="h-8 w-24 text-right" value={value} onChange={(e) => setValue(e.target.value)} />
            <Button size="icon" variant="ghost" onClick={save} disabled={pending} aria-label="Save">
              <Check className="h-4 w-4 text-green-600" />
            </Button>
          </span>
        ) : (
          <span className="font-semibold">
            {fmtQty(line.qtyPerUnit)} <span className="text-xs font-normal text-slate-400">{line.unit}</span>
          </span>
        )}
        {error && <div className="text-xs text-red-600">{error}</div>}
      </TD>
      <TD className="text-right tabular-nums text-slate-500">
        {fmtQty(line.stockQty)} {line.unit}
      </TD>
      <TD className="text-right tabular-nums text-slate-500">{lineCost != null ? fmtMoney(lineCost) : "—"}</TD>
      {!readOnly && (
        <TD className="text-right">
          <div className="flex justify-end gap-1">
            <Button size="icon" variant="ghost" onClick={() => setEditing((e) => !e)} aria-label="Edit qty">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={remove} disabled={pending} aria-label="Remove">
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </div>
        </TD>
      )}
    </TR>
  );
}
