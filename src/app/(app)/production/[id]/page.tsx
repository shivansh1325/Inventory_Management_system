import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/page-header";
import { fmtQty, fmtMoney, mulQty } from "@/lib/qty";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: { id: string } }) {
  const [run, settings] = await Promise.all([
    db.productionRun.findUnique({
      where: { id: params.id },
      include: {
        product: true,
        warehouse: true,
        lines: { include: { component: true } },
      },
    }),
    getSettings(),
  ]);
  if (!run) notFound();

  // Before/after from the movements this run wrote (balanceAfter is the total).
  const movements = await db.stockMovement.findMany({
    where: { refType: "ProductionRun", refId: run.id, type: "PRODUCTION_CONSUMPTION" },
  });
  const balanceByComponent = new Map(movements.map((m) => [m.componentId, m.balanceAfter]));

  const materialCost = run.lines.reduce(
    (sum, l) => sum + (l.component.unitCost != null ? mulQty(l.qtyConsumed, l.component.unitCost) : 0),
    0,
  );

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={`Production run ${run.runNo}`}
          subtitle={`${run.product.name} · ${fmtQty(run.qtyToProduce)} ${run.product.unit}`}
          crumbs={[
            { label: "Operations" },
            { label: "Production", href: "/production" },
            { label: run.runNo },
          ]}
          actions={
            <>
              <PrintButton />
              <Link
                href="/production"
                className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-surface px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                All runs
              </Link>
            </>
          }
        />
      </div>

      <Card className="print-slip mx-auto max-w-3xl">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{settings.companyName}</CardTitle>
              <p className="text-sm text-slate-500">Production slip · {run.runNo}</p>
            </div>
            <StatusBadge status={run.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <div className="text-xs text-slate-400">Product</div>
              <div className="font-medium">{run.product.name}</div>
              <div className="font-mono text-xs text-slate-400">{run.product.sku}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Quantity produced</div>
              <div className="font-semibold tabular-nums">
                {fmtQty(run.qtyToProduce)} {run.product.unit}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Source warehouse</div>
              <div className="font-medium">{run.warehouse?.name ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Produced at</div>
              <div className="font-medium">
                {(run.producedAt ?? run.createdAt).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              {run.createdBy && <div className="text-xs text-slate-400">by {run.createdBy}</div>}
            </div>
          </div>

          {run.note && (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">{run.note}</p>
          )}

          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700">
              Materials consumed (BOM snapshot at run time)
            </div>
            <Table>
              <THead>
                <TR>
                  <TH>Component</TH>
                  <TH className="text-right">Per unit</TH>
                  <TH className="text-right">Consumed</TH>
                  <TH className="text-right">Stock after run</TH>
                  <TH className="text-right">Cost</TH>
                </TR>
              </THead>
              <TBody>
                {run.lines.map((l) => (
                  <TR key={l.id}>
                    <TD>
                      <div className="font-medium">{l.component.name}</div>
                      <div className="font-mono text-xs text-slate-400">{l.component.sku}</div>
                    </TD>
                    <TD className="text-right tabular-nums text-slate-500">
                      {fmtQty(l.qtyPerUnitSnapshot)} {l.component.unit}
                    </TD>
                    <TD className="text-right font-semibold tabular-nums">
                      {fmtQty(l.qtyConsumed)} {l.component.unit}
                    </TD>
                    <TD className="text-right tabular-nums text-slate-500">
                      {balanceByComponent.has(l.componentId)
                        ? `${fmtQty(balanceByComponent.get(l.componentId)!)} ${l.component.unit}`
                        : "—"}
                    </TD>
                    <TD className="text-right tabular-nums text-slate-500">
                      {l.component.unitCost != null
                        ? fmtMoney(mulQty(l.qtyConsumed, l.component.unitCost))
                        : "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <div className="mt-2 flex justify-end text-sm">
              <span className="text-slate-500">Total material cost:&nbsp;</span>
              <span className="font-semibold tabular-nums">
                {materialCost > 0 ? `${settings.currency} ${fmtMoney(materialCost)}` : "—"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
