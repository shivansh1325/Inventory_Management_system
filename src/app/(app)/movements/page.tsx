import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { fmtQty } from "@/lib/qty";
import { MOVEMENT_TYPES } from "@/lib/validation";
import { buildMovementWhere, type MovementSearchParams } from "@/lib/movement-filter";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const typeTone: Record<string, "ok" | "low" | "out" | "info" | "neutral"> = {
  RECEIPT: "ok",
  ADJUSTMENT: "low",
  PRODUCTION_CONSUMPTION: "out",
  PRODUCTION_OUTPUT: "info",
  RUN_REVERSAL: "neutral",
  TRANSFER_OUT: "neutral",
  TRANSFER_IN: "neutral",
};

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: MovementSearchParams & { page?: string };
}) {
  const user = await requireUser();
  const canExport = can(user.role, "export.data");
  const where = buildMovementWhere(searchParams);
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  const [total, movements, components, products, warehouses, runs] = await Promise.all([
    db.stockMovement.count({ where }),
    db.stockMovement.findMany({
      where,
      include: { component: true, product: true, warehouse: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.component.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.warehouse.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.productionRun.findMany({ select: { id: true, runNo: true } }),
  ]);
  const runNoById = new Map(runs.map((r) => [r.id, r.runNo]));
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (overrides: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { ...searchParams, ...overrides };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  return (
    <>
      <PageHeader
        title="Stock movements"
        subtitle={`Immutable audit trail — ${total} movement${total === 1 ? "" : "s"} match`}
        crumbs={[{ label: "Operations" }, { label: "Movements" }]}
        actions={
          canExport ? (
            <a
              href={`/api/movements/export${qs({ page: undefined })}`}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-surface px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" /> Export CSV
            </a>
          ) : undefined
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Type</label>
          <select name="type" defaultValue={searchParams.type ?? ""} className="h-9 rounded-md border border-slate-300 bg-surface px-2.5 text-sm">
            <option value="">All types</option>
            {MOVEMENT_TYPES.map((t) => (
              <option key={t} value={t}>{t.replaceAll("_", " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Item</label>
          <select name="item" defaultValue={searchParams.item ?? ""} className="h-9 max-w-56 rounded-md border border-slate-300 bg-surface px-2.5 text-sm">
            <option value="">All items</option>
            <optgroup label="Components">
              {components.map((c) => (
                <option key={c.id} value={`c:${c.id}`}>{c.name}</option>
              ))}
            </optgroup>
            <optgroup label="Products">
              {products.map((p) => (
                <option key={p.id} value={`p:${p.id}`}>{p.name}</option>
              ))}
            </optgroup>
          </select>
        </div>
        {warehouses.length > 1 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Warehouse</label>
            <select name="warehouse" defaultValue={searchParams.warehouse ?? ""} className="h-9 rounded-md border border-slate-300 bg-surface px-2.5 text-sm">
              <option value="">All</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">From</label>
          <input type="date" name="from" defaultValue={searchParams.from ?? ""} className="h-9 rounded-md border border-slate-300 bg-surface px-2.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
          <input type="date" name="to" defaultValue={searchParams.to ?? ""} className="h-9 rounded-md border border-slate-300 bg-surface px-2.5 text-sm" />
        </div>
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover">
          Filter
        </button>
        <Link href="/movements" className="h-9 rounded-md px-3 py-2 text-sm text-slate-500 hover:text-slate-700">Reset</Link>
      </form>

      <div className="rounded-card border border-slate-200 bg-surface shadow-card">
        <Table>
          <THead>
            <TR>
              <TH>Date / time</TH>
              <TH>Item</TH>
              <TH>Warehouse</TH>
              <TH>Type</TH>
              <TH className="text-right">Change</TH>
              <TH className="text-right">Balance after</TH>
              <TH>Ref</TH>
              <TH>By</TH>
              <TH>Reason / note</TH>
            </TR>
          </THead>
          <TBody>
            {movements.length === 0 ? (
              <TR>
                <TD colSpan={9} className="py-10 text-center text-slate-400">No movements match the filter.</TD>
              </TR>
            ) : (
              movements.map((m) => {
                const item = m.component ?? m.product;
                const unit = item && "unit" in item ? item.unit : "";
                return (
                  <TR key={m.id}>
                    <TD className="whitespace-nowrap text-xs text-slate-500">
                      {m.createdAt.toLocaleString("en-GB", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </TD>
                    <TD className="font-medium">
                      {item?.name ?? "—"}
                      <span className="ml-1.5 text-xs font-normal text-slate-400">
                        {m.componentId ? "component" : "product"}
                      </span>
                    </TD>
                    <TD className="text-xs text-slate-500">{m.warehouse?.name ?? "—"}</TD>
                    <TD><Badge tone={typeTone[m.type] ?? "neutral"}>{m.type.replaceAll("_", " ")}</Badge></TD>
                    <TD className={`text-right font-semibold tabular-nums ${m.qtyChange < 0 ? "text-danger" : "text-success"}`}>
                      {m.qtyChange > 0 ? "+" : ""}{fmtQty(m.qtyChange)} {unit}
                    </TD>
                    <TD className="text-right tabular-nums text-slate-500">{fmtQty(m.balanceAfter)} {unit}</TD>
                    <TD className="font-mono text-xs text-slate-500">
                      {m.refType === "ProductionRun" && m.refId ? (
                        <Link href={`/production/${m.refId}`} className="text-primary hover:underline dark:text-indigo-300">
                          {runNoById.get(m.refId) ?? "—"}
                        </Link>
                      ) : m.refType === "PurchaseRequisition" && m.refId ? (
                        <Link href={`/purchasing/${m.refId}`} className="text-primary hover:underline dark:text-indigo-300">
                          receipt
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD className="text-xs text-slate-500">{m.createdBy ?? "—"}</TD>
                    <TD className="max-w-[16rem] truncate text-xs text-slate-500">{m.reason ?? "—"}</TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            <span>Page {page} of {pageCount}</span>
            <span className="flex gap-2">
              {page > 1 && (
                <Link href={qs({ page: String(page - 1) })} className="inline-flex items-center gap-1 text-primary hover:underline dark:text-indigo-300">
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </Link>
              )}
              {page < pageCount && (
                <Link href={qs({ page: String(page + 1) })} className="inline-flex items-center gap-1 text-primary hover:underline dark:text-indigo-300">
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
