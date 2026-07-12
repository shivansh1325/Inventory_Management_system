"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Factory,
  ChevronLeft,
  ChevronRight,
  Package,
  ShoppingCart,
  Search,
} from "lucide-react";
import { createProductionRun } from "@/lib/actions";
import { createRequisitionAction } from "@/lib/purchasing-actions";
import { fmtQty, fmtMoney, toMilli, mulQty, divFloor } from "@/lib/qty";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export type WizardProduct = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  finishedStockQty: number;
  bom: {
    componentId: string;
    sku: string;
    name: string;
    unit: string;
    qtyPerUnit: number; // milli
    unitCost: number | null; // milli
    levels: Record<string, number>; // warehouseId -> qty milli
  }[];
};

export type WizardWarehouse = { id: string; name: string; isDefault: boolean };

const QTY_RE = /^\d+(\.\d{1,3})?$/;

const STEPS = ["Product", "Quantity & feasibility", "Review & confirm"];

export function NewRunWizard({
  products,
  warehouses,
  initialProductId,
  canRaiseRequisition,
}: {
  products: WizardProduct[];
  warehouses: WizardWarehouse[];
  initialProductId?: string;
  canRaiseRequisition: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(
    initialProductId && products.some((p) => p.id === initialProductId) ? 1 : 0,
  );
  const [productId, setProductId] = useState(
    initialProductId && products.some((p) => p.id === initialProductId) ? initialProductId : "",
  );
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? "",
  );
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const product = products.find((p) => p.id === productId) ?? null;
  const qtyValid = QTY_RE.test(qty.trim()) && parseFloat(qty) > 0;
  const qtyMilli = qtyValid ? toMilli(qty.trim()) : null;

  const available = (b: WizardProduct["bom"][number]) => b.levels[warehouseId] ?? 0;

  const buildable = useMemo(() => {
    if (!product || product.bom.length === 0) return 0;
    return Math.min(...product.bom.map((b) => divFloor(available(b), b.qtyPerUnit)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, warehouseId]);

  const feasibility = useMemo(() => {
    if (!product || qtyMilli == null) return null;
    const lines = product.bom.map((b) => {
      const required = mulQty(b.qtyPerUnit, qtyMilli);
      const avail = available(b);
      return { ...b, required, available: avail, ok: avail >= required, shortfall: Math.max(0, required - avail) };
    });
    return { lines, feasible: lines.length > 0 && lines.every((l) => l.ok) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, qtyMilli, warehouseId]);

  const materialCost = useMemo(() => {
    if (!feasibility) return 0;
    return feasibility.lines.reduce(
      (sum, l) => sum + (l.unitCost != null ? mulQty(l.required, l.unitCost) : 0),
      0,
    );
  }, [feasibility]);

  const shortfalls = feasibility?.lines.filter((l) => !l.ok) ?? [];

  const produce = () => {
    if (!product || !feasibility?.feasible || qtyMilli == null) return;
    setServerError(null);
    startTransition(async () => {
      const res = await createProductionRun({
        productId: product.id,
        qty: qty.trim(),
        note,
        warehouseId,
      });
      if (!res.ok) {
        setServerError(
          res.shortfalls?.length
            ? `${res.error}: ` + res.shortfalls.map((s) => `${s.name} short ${s.shortLabel}`).join(", ")
            : (res.error ?? "Failed"),
        );
      } else {
        toast.success(`Run ${res.runNo} completed — stock deducted`);
        router.push(`/production/${res.runId}`);
      }
    });
  };

  const raiseRequisition = () => {
    if (!product || shortfalls.length === 0) return;
    startTransition(async () => {
      const res = await createRequisitionAction({
        warehouseId,
        note: `Shortfall for ${product.name} ×${qty}`,
        submit: true,
        lines: shortfalls.map((s) => ({ componentId: s.componentId, qty: fmtQty(s.shortfall) })),
      });
      if (!res.ok) toast.error(res.error ?? "Could not create requisition");
      else {
        toast.success(`${res.prNo} raised for the shortfall — pending approval`);
        router.push(`/purchasing/${res.requisitionId}`);
      }
    });
  };

  const filteredProducts = products.filter(
    (p) =>
      !search.trim() ||
      `${p.name} ${p.sku}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-4xl">
      {/* Stepper */}
      <ol className="mb-6 flex items-center gap-2" aria-label="Wizard progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                i < step
                  ? "bg-success text-white"
                  : i === step
                    ? "bg-primary text-white"
                    : "bg-slate-200 text-slate-500",
              )}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span className={cn("hidden text-sm sm:block", i === step ? "font-semibold text-slate-900" : "text-slate-400")}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200" />}
          </li>
        ))}
      </ol>

      {/* Step 1: product picker */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              autoFocus
              placeholder="Search products…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((p) => {
              const b =
                p.bom.length === 0
                  ? null
                  : Math.min(...p.bom.map((x) => divFloor(x.levels[warehouseId] ?? 0, x.qtyPerUnit)));
              const selected = p.id === productId;
              return (
                <button
                  key={p.id}
                  onClick={() => setProductId(p.id)}
                  className={cn(
                    "rounded-card border bg-surface p-4 text-left shadow-card transition-all hover:shadow-md",
                    selected ? "border-primary ring-2 ring-primary/30" : "border-slate-200",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary dark:text-slate-800">
                      <Package className="h-4 w-4" />
                    </div>
                    {b == null ? (
                      <Badge tone="neutral">No BOM</Badge>
                    ) : b === 0 ? (
                      <Badge tone="out">0 buildable</Badge>
                    ) : (
                      <Badge tone="ok">{b} buildable</Badge>
                    )}
                  </div>
                  <div className="mt-2 font-semibold text-slate-900">{p.name}</div>
                  <div className="font-mono text-xs text-slate-400">{p.sku}</div>
                  {p.description && (
                    <div className="mt-1 line-clamp-2 text-xs text-slate-500">{p.description}</div>
                  )}
                </button>
              );
            })}
            {filteredProducts.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-slate-400">No products match.</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              disabled={!product || product.bom.length === 0}
              title={
                !product
                  ? "Pick a product first"
                  : product.bom.length === 0
                    ? "This product has no BOM — define one before producing"
                    : undefined
              }
              onClick={() => setStep(1)}
            >
              Continue <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: quantity + feasibility */}
      {step === 1 && product && (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-4 p-4">
              <div className="min-w-0">
                <div className="text-xs text-slate-400">Product</div>
                <div className="truncate font-semibold">{product.name}</div>
              </div>
              {warehouses.length > 1 && (
                <div className="w-52 space-y-1">
                  <Label>Source warehouse</Label>
                  <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="w-44 space-y-1">
                <Label>Quantity ({product.unit}) *</Label>
                <Input
                  autoFocus
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 10"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={buildable === 0}
                onClick={() => setQty(String(buildable))}
                title="Set quantity to the maximum buildable with current stock"
              >
                Max: {buildable}
              </Button>
              <div className="ml-auto text-sm text-slate-500">
                Finished stock: <b className="tabular-nums">{fmtQty(product.finishedStockQty)} {product.unit}</b>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feasibility — required vs available</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>Component</TH>
                    <TH className="text-right">Per unit</TH>
                    <TH className="text-right">Required</TH>
                    <TH className="text-right">Available</TH>
                    <TH className="text-right">Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {(feasibility?.lines ??
                    product.bom.map((b) => ({
                      ...b,
                      required: null as number | null,
                      available: available(b),
                      ok: null as boolean | null,
                      shortfall: 0,
                    }))
                  ).map((l) => (
                    <TR key={l.componentId} className={l.ok === false ? "bg-danger/5" : l.ok ? "bg-success/5" : ""}>
                      <TD>
                        <div className="font-medium">{l.name}</div>
                        <div className="font-mono text-xs text-slate-400">{l.sku}</div>
                      </TD>
                      <TD className="text-right tabular-nums text-slate-500">
                        {fmtQty(l.qtyPerUnit)} {l.unit}
                      </TD>
                      <TD className="text-right font-semibold tabular-nums">
                        {l.required != null ? `${fmtQty(l.required)} ${l.unit}` : "—"}
                      </TD>
                      <TD className="text-right tabular-nums text-slate-500">
                        {fmtQty(l.available)} {l.unit}
                      </TD>
                      <TD className="text-right">
                        {l.ok == null ? (
                          <span className="text-slate-300">—</span>
                        ) : l.ok ? (
                          <CheckCircle2 className="ml-auto h-5 w-5 text-success" />
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <Badge tone="out">short {fmtQty(l.shortfall)} {l.unit}</Badge>
                            <XCircle className="h-5 w-5 text-danger" />
                          </span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              {shortfalls.length > 0 && qtyValid && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5">
                  <span className="text-sm text-danger">
                    {shortfalls.length} component{shortfalls.length > 1 ? "s" : ""} short — the run is blocked;
                    nothing will be deducted.
                  </span>
                  {canRaiseRequisition && (
                    <Button size="sm" variant="secondary" onClick={raiseRequisition} disabled={pending}>
                      <ShoppingCart className="h-3.5 w-3.5" /> Raise requisition for shortfall
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(0)}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              disabled={!qtyValid || !feasibility?.feasible}
              title={
                !qtyValid
                  ? "Enter a valid quantity first"
                  : !feasibility?.feasible
                    ? `Blocked by shortfalls: ${shortfalls.map((s) => s.name).join(", ")}`
                    : undefined
              }
              onClick={() => setStep(2)}
            >
              Review <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: review & confirm */}
      {step === 2 && product && feasibility && qtyMilli != null && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Review — {product.name} × {fmtQty(qtyMilli)} {product.unit}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Estimated material cost</div>
                  <div className="text-lg font-bold tabular-nums">{materialCost > 0 ? fmtMoney(materialCost) : "—"}</div>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Source warehouse</div>
                  <div className="text-lg font-bold">
                    {warehouses.find((w) => w.id === warehouseId)?.name ?? "—"}
                  </div>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Finished stock after run</div>
                  <div className="text-lg font-bold tabular-nums">
                    {fmtQty(product.finishedStockQty + qtyMilli)} {product.unit}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-sm font-semibold text-slate-700">
                  BOM snapshot to be recorded (edits to the BOM later won't affect this run)
                </div>
                <ul className="divide-y divide-slate-100 text-sm">
                  {feasibility.lines.map((l) => (
                    <li key={l.componentId} className="flex items-center justify-between py-1.5">
                      <span>{l.name}</span>
                      <span className="tabular-nums text-slate-600">
                        −{fmtQty(l.required)} {l.unit}
                        <span className="ml-2 text-xs text-slate-400">
                          ({fmtQty(l.qtyPerUnit)}/unit)
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1">
                <Label>Note (work order ref…)</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              {serverError && <p className="text-sm text-danger">{serverError}</p>}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button size="lg" disabled={pending} onClick={produce}>
              <Factory className="h-4 w-4" />
              {pending ? "Producing…" : `Produce ${fmtQty(qtyMilli)} ${product.unit}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
