import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { buildableUnitsTotal } from "@/lib/services/production";
import { fmtQty, fmtMoney, mulQty } from "@/lib/qty";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { NewProductButton } from "./product-form";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const user = await requireUser();
  const canWrite = can(user.role, "products.write");
  const products = await db.product.findMany({
    where: { isActive: true },
    include: { bomItems: { include: { component: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Assembly-line items and their Bills of Materials"
        crumbs={[{ label: "Inventory" }, { label: "Products & BOM" }]}
        actions={canWrite ? <NewProductButton /> : undefined}
      />
      <div className="rounded-card border border-slate-200 bg-surface shadow-sm">
        <Table>
          <THead>
            <TR>
              <TH>SKU</TH>
              <TH>Name</TH>
              <TH className="text-right">Finished stock</TH>
              <TH className="text-right">Buildable now</TH>
              <TH className="text-right">BOM lines</TH>
              <TH className="text-right">Est. material cost/unit</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {products.length === 0 ? (
              <TR>
                <TD colSpan={7} className="py-10 text-center text-slate-400">
                  No products yet — add one to define its Bill of Materials.
                </TD>
              </TR>
            ) : (
              products.map((p) => {
                const buildable = buildableUnitsTotal(p.bomItems);
                const cost = p.bomItems.reduce(
                  (sum, b) => sum + (b.component.unitCost != null ? mulQty(b.qtyPerUnit, b.component.unitCost) : 0),
                  0,
                );
                return (
                  <TR key={p.id}>
                    <TD className="font-mono text-xs text-slate-500">{p.sku}</TD>
                    <TD className="font-medium">
                      <Link href={`/products/${p.id}`} className="text-primary hover:underline">
                        {p.name}
                      </Link>
                    </TD>
                    <TD className="text-right font-semibold tabular-nums">
                      {fmtQty(p.finishedStockQty)} <span className="text-xs font-normal text-slate-400">{p.unit}</span>
                    </TD>
                    <TD className="text-right">
                      {p.bomItems.length === 0 ? (
                        <Badge tone="neutral">No BOM</Badge>
                      ) : buildable === 0 ? (
                        <Badge tone="out">0 units</Badge>
                      ) : (
                        <Badge tone="ok">{buildable} units</Badge>
                      )}
                    </TD>
                    <TD className="text-right tabular-nums text-slate-500">{p.bomItems.length}</TD>
                    <TD className="text-right tabular-nums text-slate-500">
                      {cost > 0 ? fmtMoney(cost) : "—"}
                    </TD>
                    <TD className="text-right">
                      <Link href={`/products/${p.id}`} className="text-sm text-primary hover:underline">
                        Open BOM →
                      </Link>
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </div>
    </>
  );
}
