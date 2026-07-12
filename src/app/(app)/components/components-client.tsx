"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ColumnDef } from "@tanstack/react-table";
import { Plus, Pencil, PackagePlus, Archive, ArchiveRestore, Boxes } from "lucide-react";
import { z } from "zod";
import {
  componentSchema,
  receiveStockSchema,
  adjustStockSchema,
  UNITS,
  type ComponentInput,
} from "@/lib/validation";
import {
  saveComponent,
  receiveStockAction,
  adjustStockAction,
  setComponentActive,
} from "@/lib/actions";
import { fmtQty, fmtMoney } from "@/lib/qty";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label, FieldError } from "@/components/ui/input";
import { Badge, StockBadge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip as ReTooltip } from "recharts";

export type ComponentRow = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  stockQty: number; // milli
  minLevel: number; // milli
  unitCost: number | null; // milli
  location: string | null;
  supplier: string | null;
  category: string | null;
  isActive: boolean;
};

export type WarehouseOption = { id: string; name: string; isDefault: boolean };

type Perms = { write: boolean; archive: boolean; receive: boolean; adjust: boolean; export: boolean };
type Filter = "all" | "low" | "out" | "archived";

export function ComponentsClient({
  rows,
  warehouses,
  perms,
}: {
  rows: ComponentRow[];
  warehouses: WarehouseOption[];
  perms: Perms;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<ComponentRow | null | "new">(null);
  const [stockTarget, setStockTarget] = useState<ComponentRow | null>(null);
  const [detail, setDetail] = useState<ComponentRow | null>(null);
  const [archiving, setArchiving] = useState<ComponentRow | null>(null);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (filter === "archived") return !r.isActive;
        if (!r.isActive) return false;
        if (filter === "low") return r.stockQty > 0 && r.stockQty < r.minLevel;
        if (filter === "out") return r.stockQty <= 0;
        return true;
      }),
    [rows, filter],
  );

  const columns = useMemo<ColumnDef<ComponentRow, any>[]>(
    () => [
      {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ getValue }) => <span className="font-mono text-xs text-slate-500">{getValue<string>()}</span>,
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.name}
            {!row.original.isActive && <Badge tone="neutral" className="ml-2">archived</Badge>}
          </span>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ getValue }) => <span className="text-slate-500">{getValue<string | null>() ?? "—"}</span>,
      },
      {
        accessorKey: "stockQty",
        header: "Stock",
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">
            {fmtQty(row.original.stockQty)}{" "}
            <span className="text-xs font-normal text-slate-400">{row.original.unit}</span>
          </span>
        ),
      },
      {
        accessorKey: "minLevel",
        header: "Min",
        cell: ({ row }) => (
          <span className="tabular-nums text-slate-500">{fmtQty(row.original.minLevel)}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => <StockBadge stock={row.original.stockQty} minLevel={row.original.minLevel} />,
      },
      {
        accessorKey: "unitCost",
        header: "Unit cost",
        cell: ({ getValue }) => {
          const v = getValue<number | null>();
          return <span className="tabular-nums text-slate-500">{v != null ? fmtMoney(v) : "—"}</span>;
        },
      },
      {
        accessorKey: "location",
        header: "Location",
        cell: ({ getValue }) => <span className="text-slate-500">{getValue<string | null>() ?? "—"}</span>,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="secondary"
                disabled={!perms.receive || !r.isActive}
                title={
                  !perms.receive
                    ? "Your role cannot update stock"
                    : !r.isActive
                      ? "Archived — restore first"
                      : "Receive or adjust stock"
                }
                onClick={() => setStockTarget(r)}
              >
                <PackagePlus className="h-3.5 w-3.5" /> Stock
              </Button>
              {perms.write && (
                <Button size="icon" variant="ghost" onClick={() => setEditing(r)} aria-label="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {perms.archive && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setArchiving(r)}
                  aria-label={r.isActive ? "Archive" : "Restore"}
                  title={r.isActive ? "Archive (safe delete)" : "Restore"}
                >
                  {r.isActive ? (
                    <Archive className="h-3.5 w-3.5 text-slate-400" />
                  ) : (
                    <ArchiveRestore className="h-3.5 w-3.5 text-success" />
                  )}
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [perms],
  );

  return (
    <>
      <DataTable
        data={filtered}
        columns={columns}
        searchPlaceholder="Search SKU, name, supplier…"
        onRowClick={(r) => setDetail(r)}
        exportName="components"
        allowExport={perms.export}
        exportRow={(r) => ({
          SKU: r.sku,
          Name: r.name,
          Category: r.category ?? "",
          Unit: r.unit,
          Stock: fmtQty(r.stockQty),
          "Min level": fmtQty(r.minLevel),
          "Unit cost": r.unitCost != null ? fmtQty(r.unitCost) : "",
          Location: r.location ?? "",
          Supplier: r.supplier ?? "",
          Status: r.stockQty <= 0 ? "Out" : r.stockQty < r.minLevel ? "Low" : "OK",
        })}
        toolbar={
          <>
            <Select className="w-40" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="all">Active</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
              <option value="archived">Archived</option>
            </Select>
            {perms.write && (
              <Button onClick={() => setEditing("new")}>
                <Plus className="h-4 w-4" /> Add component
              </Button>
            )}
          </>
        }
        emptyState={
          <EmptyState
            icon={Boxes}
            title={filter === "archived" ? "No archived components" : "No components yet"}
            description={
              filter === "all"
                ? "Add your first raw material to start tracking stock."
                : undefined
            }
            action={
              perms.write && filter === "all" ? (
                <Button onClick={() => setEditing("new")}>
                  <Plus className="h-4 w-4" /> Add component
                </Button>
              ) : undefined
            }
          />
        }
      />

      {editing !== null && (
        <ComponentFormDialog component={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
      {stockTarget && (
        <UpdateStockDialog
          component={stockTarget}
          warehouses={warehouses}
          canAdjust={perms.adjust}
          onClose={() => setStockTarget(null)}
        />
      )}
      {detail && <ComponentDrawer component={detail} onClose={() => setDetail(null)} />}
      {archiving && <ArchiveConfirm component={archiving} onClose={() => setArchiving(null)} />}
    </>
  );
}

// ---------- Detail drawer with sparkline + recent movements ----------

type DetailData = {
  levels: { warehouse: string; qty: number }[];
  movements: {
    id: string;
    type: string;
    qtyChange: number;
    balanceAfter: number;
    warehouse: string | null;
    reason: string | null;
    createdBy: string | null;
    createdAt: string;
  }[];
};

function ComponentDrawer({ component, onClose }: { component: ComponentRow; onClose: () => void }) {
  const [data, setData] = useState<DetailData | null>(null);
  useEffect(() => {
    fetch(`/api/components/${component.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [component.id]);

  const spark = data
    ? [...data.movements].reverse().map((m, i) => ({ i, balance: m.balanceAfter / 1000 }))
    : [];

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <span>
          {component.name}{" "}
          <span className="ml-1 font-mono text-xs text-slate-400">{component.sku}</span>
        </span>
      }
      wide
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Total stock</div>
            <div className="text-lg font-bold tabular-nums">
              {fmtQty(component.stockQty)} <span className="text-xs font-normal text-slate-400">{component.unit}</span>
            </div>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Min level</div>
            <div className="text-lg font-bold tabular-nums">{fmtQty(component.minLevel)}</div>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Status</div>
            <div className="mt-1"><StockBadge stock={component.stockQty} minLevel={component.minLevel} /></div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-sm font-semibold text-slate-700">
            Stock trend (last {spark.length} movements)
          </div>
          {data == null ? (
            <Skeleton className="h-20 w-full" />
          ) : spark.length < 2 ? (
            <p className="text-sm text-slate-400">Not enough history yet.</p>
          ) : (
            <div className="h-20">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spark} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
                  <YAxis hide domain={["auto", "auto"]} />
                  <ReTooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="rounded border border-slate-200 bg-surface px-2 py-1 text-xs shadow-md">
                          {payload[0].value} {component.unit}
                        </div>
                      ) : null
                    }
                  />
                  <Line type="monotone" dataKey="balance" stroke="#3730A3" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 text-sm font-semibold text-slate-700">Per warehouse</div>
          {data == null ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.levels.map((l) => (
                <span key={l.warehouse} className="rounded-md border border-slate-200 px-2.5 py-1 text-sm">
                  {l.warehouse}: <b className="tabular-nums">{fmtQty(l.qty)}</b> {component.unit}
                </span>
              ))}
              {data.levels.length === 0 && (
                <span className="text-sm text-slate-400">No stock recorded yet.</span>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 text-sm font-semibold text-slate-700">Recent movements</div>
          {data == null ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : data.movements.length === 0 ? (
            <p className="text-sm text-slate-400">No movements yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-sm">
              {data.movements.slice(0, 15).map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-2">
                  <Badge tone={m.qtyChange < 0 ? "out" : "ok"} className="w-fit shrink-0">
                    {m.type.replaceAll("_", " ")}
                  </Badge>
                  <span
                    className={`w-24 shrink-0 text-right font-semibold tabular-nums ${
                      m.qtyChange < 0 ? "text-danger" : "text-success"
                    }`}
                  >
                    {m.qtyChange > 0 ? "+" : ""}
                    {fmtQty(m.qtyChange)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
                    {m.warehouse ?? ""} {m.reason ? `· ${m.reason}` : ""}{" "}
                    {m.createdBy ? `· ${m.createdBy}` : ""}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {new Date(m.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

// ---------- Archive / restore ----------

function ArchiveConfirm({ component, onClose }: { component: ComponentRow; onClose: () => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const archive = component.isActive;
  return (
    <ConfirmDialog
      title={archive ? `Archive ${component.name}?` : `Restore ${component.name}?`}
      description={
        archive
          ? "Archived components keep their full movement history and BOM references but are hidden from lists and cannot be stocked or consumed. This is the safe alternative to deletion."
          : "The component becomes usable again."
      }
      confirmLabel={archive ? "Archive" : "Restore"}
      destructive={archive}
      pending={pending}
      onClose={onClose}
      onConfirm={() =>
        startTransition(async () => {
          const res = await setComponentActive(component.id, !archive);
          if (!res.ok) toast.error(res.error ?? "Failed");
          else {
            toast.success(archive ? "Component archived" : "Component restored");
            onClose();
          }
        })
      }
    />
  );
}

// ---------- Add / edit form ----------

const extendedSchema = componentSchema.extend({
  category: z.string().trim().max(60).optional().or(z.literal("")),
});
type FormInput = z.infer<typeof extendedSchema>;

function ComponentFormDialog({
  component,
  onClose,
}: {
  component: ComponentRow | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(extendedSchema),
    defaultValues: component
      ? {
          sku: component.sku,
          name: component.name,
          unit: component.unit as ComponentInput["unit"],
          minLevel: fmtQty(component.minLevel),
          unitCost: component.unitCost != null ? fmtQty(component.unitCost) : "",
          location: component.location ?? "",
          supplier: component.supplier ?? "",
          category: component.category ?? "",
        }
      : { unit: "pcs", minLevel: "0", unitCost: "", location: "", supplier: "", category: "" },
  });

  const onSubmit = (data: FormInput) =>
    startTransition(async () => {
      const res = await saveComponent(component?.id ?? null, data);
      if (!res.ok) setServerError(res.error ?? "Failed");
      else {
        toast.success(component ? "Component updated" : "Component created");
        onClose();
      }
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{component ? "Edit component" : "Add component"}</DialogTitle>
        <DialogDescription>
          {component
            ? "Stock quantity is changed via “Stock”, not here."
            : "New components start at 0 stock — use “Stock → Receive” to add inventory."}
        </DialogDescription>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>SKU *</Label>
              <Input {...register("sku")} placeholder="CMP-SCREW-M4" />
              <FieldError message={errors.sku?.message} />
            </div>
            <div className="space-y-1">
              <Label>Unit *</Label>
              <Select {...register("unit")}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input {...register("name")} placeholder="M4 Screw 12mm" />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Category</Label>
              <Input {...register("category")} placeholder="Fasteners" />
            </div>
            <div className="space-y-1">
              <Label>Min level (reorder threshold)</Label>
              <Input {...register("minLevel")} inputMode="decimal" />
              <FieldError message={errors.minLevel?.message} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Unit cost (optional)</Label>
              <Input {...register("unitCost")} inputMode="decimal" placeholder="0.00" />
              <FieldError message={errors.unitCost?.message as string | undefined} />
            </div>
            <div className="space-y-1">
              <Label>Location (bin/shelf)</Label>
              <Input {...register("location")} placeholder="A-03" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Supplier</Label>
            <Input {...register("supplier")} />
          </div>
          {serverError && <p className="text-sm text-danger">{serverError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Update stock dialog (receive / adjust) ----------

const receiveFormSchema = receiveStockSchema.omit({ componentId: true });
const adjustFormSchema = adjustStockSchema.omit({ componentId: true });

function UpdateStockDialog({
  component,
  warehouses,
  canAdjust,
  onClose,
}: {
  component: ComponentRow;
  warehouses: WarehouseOption[];
  canAdjust: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"receive" | "adjust">("receive");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Update stock — {component.name}</DialogTitle>
        <DialogDescription>
          Current total: <b>{fmtQty(component.stockQty)} {component.unit}</b>. Every change is
          recorded in the movement ledger.
        </DialogDescription>
        <div className="mt-4 flex gap-1 rounded-md bg-slate-100 p-1">
          {(["receive", "adjust"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={m === "adjust" && !canAdjust}
              title={
                m === "adjust" && !canAdjust
                  ? "Your role cannot make corrections — ask a Manager/Admin"
                  : undefined
              }
              onClick={() => setMode(m)}
              className={`flex-1 rounded px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                mode === m ? "bg-surface text-primary shadow-sm dark:text-slate-900" : "text-slate-500"
              }`}
            >
              {m === "receive" ? "Receive stock" : "Adjust / correct"}
            </button>
          ))}
        </div>
        {mode === "receive" ? (
          <ReceiveForm component={component} warehouses={warehouses} onClose={onClose} />
        ) : (
          <AdjustForm component={component} warehouses={warehouses} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function WarehousePicker({
  warehouses,
  register,
}: {
  warehouses: WarehouseOption[];
  register: ReturnType<typeof useForm>["register"] | any;
}) {
  if (warehouses.length <= 1) return null; // single-warehouse UX stays simple
  return (
    <div className="space-y-1">
      <Label>Warehouse</Label>
      <Select {...register("warehouseId")}>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
            {w.isDefault ? " (default)" : ""}
          </option>
        ))}
      </Select>
    </div>
  );
}

function ReceiveForm({
  component,
  warehouses,
  onClose,
}: {
  component: ComponentRow;
  warehouses: WarehouseOption[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof receiveFormSchema>>({
    resolver: zodResolver(receiveFormSchema),
    defaultValues: {
      qty: "",
      note: "",
      warehouseId: warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id,
    },
  });
  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={handleSubmit((data) =>
        startTransition(async () => {
          const res = await receiveStockAction({ ...data, componentId: component.id });
          if (!res.ok) setServerError(res.error ?? "Failed");
          else {
            toast.success(`Received ${data.qty} ${component.unit} of ${component.name}`);
            onClose();
          }
        }),
      )}
    >
      <WarehousePicker warehouses={warehouses} register={register} />
      <div className="space-y-1">
        <Label>Quantity to receive ({component.unit}) *</Label>
        <Input {...register("qty")} inputMode="decimal" autoFocus />
        <FieldError message={errors.qty?.message} />
      </div>
      <div className="space-y-1">
        <Label>Note (PO number, supplier…)</Label>
        <Input {...register("note")} />
      </div>
      {serverError && <p className="text-sm text-danger">{serverError}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Recording…" : "Receive"}</Button>
      </div>
    </form>
  );
}

function AdjustForm({
  component,
  warehouses,
  onClose,
}: {
  component: ComponentRow;
  warehouses: WarehouseOption[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<z.infer<typeof adjustFormSchema>>({
    resolver: zodResolver(adjustFormSchema),
    defaultValues: {
      mode: "SET",
      qty: "",
      reason: "",
      warehouseId: warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id,
    },
  });
  const m = watch("mode");
  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={handleSubmit((data) =>
        startTransition(async () => {
          const res = await adjustStockAction({ ...data, componentId: component.id });
          if (!res.ok) setServerError(res.error ?? "Failed");
          else {
            toast.success("Stock adjusted");
            onClose();
          }
        }),
      )}
    >
      <WarehousePicker warehouses={warehouses} register={register} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Mode</Label>
          <Select {...register("mode")}>
            <option value="SET">Set to exact value</option>
            <option value="DELTA">Add / subtract (+/−)</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{m === "SET" ? `New value (${component.unit})` : `Change (± ${component.unit})`} *</Label>
          <Input {...register("qty")} inputMode="decimal" placeholder={m === "SET" ? "e.g. 120" : "e.g. -5"} />
          <FieldError message={errors.qty?.message} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Reason (mandatory) *</Label>
        <Textarea {...register("reason")} placeholder="Cycle count correction, damaged parts…" />
        <FieldError message={errors.reason?.message} />
      </div>
      {serverError && <p className="text-sm text-danger">{serverError}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={pending} variant="destructive">
          {pending ? "Adjusting…" : "Apply adjustment"}
        </Button>
      </div>
    </form>
  );
}
