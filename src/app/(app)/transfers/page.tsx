import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { requirePagePermission } from "@/lib/page-guard";
import { fmtQty } from "@/lib/qty";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TransferForm } from "./transfer-form";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  await requirePagePermission("warehouse.transfer");
  const [components, warehouses, recent] = await Promise.all([
    db.component.findMany({
      where: { isActive: true },
      include: { stockLevels: true },
      orderBy: { name: "asc" },
    }),
    db.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.stockMovement.findMany({
      where: { type: "TRANSFER_OUT" },
      include: { component: true, warehouse: true },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Warehouse transfers"
        subtitle="Move stock between locations — paired out/in movements, fully transactional"
        crumbs={[{ label: "Operations" }, { label: "Transfers" }]}
      />
      {warehouses.length < 2 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            Transfers need at least two active warehouses. Ask an Admin to add one under
            Inventory → Warehouses.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[24rem_1fr]">
          <TransferForm
            components={components.map((c) => ({
              id: c.id,
              name: c.name,
              sku: c.sku,
              unit: c.unit,
              levels: Object.fromEntries(c.stockLevels.map((l) => [l.warehouseId, l.qty])),
            }))}
            warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault }))}
          />
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Recent transfers</CardTitle>
              <CardDescription>Latest 25 (see Movements for the full trail)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Component</TH>
                    <TH className="text-right">Qty</TH>
                    <TH>From</TH>
                    <TH>Note</TH>
                    <TH>By</TH>
                  </TR>
                </THead>
                <TBody>
                  {recent.length === 0 ? (
                    <TR><TD colSpan={6} className="py-8 text-center text-slate-400">No transfers yet.</TD></TR>
                  ) : (
                    recent.map((m) => (
                      <TR key={m.id}>
                        <TD className="whitespace-nowrap text-xs text-slate-500">
                          {m.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                        </TD>
                        <TD className="font-medium">{m.component?.name}</TD>
                        <TD className="text-right font-semibold tabular-nums">
                          {fmtQty(-m.qtyChange)} {m.component?.unit}
                        </TD>
                        <TD className="text-xs text-slate-500">{m.warehouse?.name}</TD>
                        <TD className="max-w-[12rem] truncate text-xs text-slate-500">{m.reason ?? "—"}</TD>
                        <TD className="text-xs text-slate-500">{m.createdBy ?? "—"}</TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
