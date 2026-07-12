import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { fmtQty, fmtMoney, mulQty } from "@/lib/qty";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StockBadge } from "@/components/ui/badge";
import { Download, ShoppingCart } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requireUser();
  const canExport = can(user.role, "export.data");
  const canRaise = can(user.role, "purchasing.raise");
  const components = await db.component.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  const low = components.filter((c) => c.stockQty <= c.minLevel);

  return (
    <>
      <PageHeader
        title="Low stock / Reorder report"
        subtitle="Components at or below their minimum level, with suggested reorder quantities"
        crumbs={[{ label: "Reports" }, { label: "Low stock / Reorder" }]}
        actions={
          canExport ? (
            <a
              href="/api/reports/low-stock"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-surface px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" /> Export CSV
            </a>
          ) : undefined
        }
      />
      <div className="rounded-card border border-slate-200 bg-surface shadow-sm">
        <Table>
          <THead>
            <TR>
              <TH>SKU</TH>
              <TH>Component</TH>
              <TH>Status</TH>
              <TH className="text-right">In stock</TH>
              <TH className="text-right">Min level</TH>
              <TH className="text-right">Suggested reorder*</TH>
              <TH className="text-right">Est. cost</TH>
              <TH>Supplier</TH>
              {canRaise && <TH className="text-right" />}
            </TR>
          </THead>
          <TBody>
            {low.length === 0 ? (
              <TR>
                <TD colSpan={9} className="py-10 text-center text-slate-400">
                  Nothing to reorder — all components are above their minimum level. 🎉
                </TD>
              </TR>
            ) : (
              low.map((c) => {
                // Suggest topping up to 2x min level — simple, predictable heuristic.
                const suggested = Math.max(0, c.minLevel * 2 - c.stockQty);
                const cost = c.unitCost != null ? mulQty(suggested, c.unitCost) : null;
                return (
                  <TR key={c.id}>
                    <TD className="font-mono text-xs text-slate-500">{c.sku}</TD>
                    <TD className="font-medium">{c.name}</TD>
                    <TD><StockBadge stock={c.stockQty} minLevel={c.minLevel} /></TD>
                    <TD className="text-right tabular-nums">{fmtQty(c.stockQty)} {c.unit}</TD>
                    <TD className="text-right tabular-nums text-slate-500">{fmtQty(c.minLevel)} {c.unit}</TD>
                    <TD className="text-right font-semibold tabular-nums">{fmtQty(suggested)} {c.unit}</TD>
                    <TD className="text-right tabular-nums text-slate-500">{cost != null ? fmtMoney(cost) : "—"}</TD>
                    <TD className="text-slate-500">{c.supplier ?? "—"}</TD>
                    {canRaise && (
                      <TD className="text-right">
                        <Link
                          href={`/purchasing/new?componentId=${c.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline dark:text-indigo-300"
                        >
                          <ShoppingCart className="h-3.5 w-3.5" /> Raise requisition
                        </Link>
                      </TD>
                    )}
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-slate-400">* Suggested reorder tops stock up to 2× the minimum level.</p>
    </>
  );
}
