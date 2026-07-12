import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { buildableUnitsTotal } from "@/lib/services/production";
import { fmtQty } from "@/lib/qty";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BomEditor } from "./bom-editor";
import { EditProductButton } from "./edit-button";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const canWrite = can(user.role, "products.write");
  const product = await db.product.findUnique({
    where: { id: params.id },
    include: { bomItems: { include: { component: true }, orderBy: { component: { name: "asc" } } } },
  });
  if (!product) notFound();

  const allComponents = await db.component.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  const buildable = buildableUnitsTotal(product.bomItems);

  return (
    <>
      <PageHeader
        title={product.name}
        subtitle={`${product.sku}${product.description ? " · " + product.description : ""}`}
        crumbs={[{ label: "Inventory" }, { label: "Products & BOM", href: "/products" }, { label: product.sku }]}
        actions={
          <>
            {canWrite && (
              <EditProductButton
                product={{
                  id: product.id,
                  sku: product.sku,
                  name: product.name,
                  description: product.description,
                  unit: product.unit,
                }}
              />
            )}
            <Link
              href={`/production/new?productId=${product.id}`}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
            >
              Produce →
            </Link>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm text-slate-500">Finished stock</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">
            {fmtQty(product.finishedStockQty)} <span className="text-sm font-normal text-slate-400">{product.unit}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-slate-500">Buildable now</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">
            {product.bomItems.length === 0 ? (
              <span className="text-base font-medium text-slate-400">No BOM defined</span>
            ) : (
              <>{buildable} <span className="text-sm font-normal text-slate-400">units</span></>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-slate-500">BOM lines</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold tabular-nums">{product.bomItems.length}</CardContent>
        </Card>
      </div>

      <BomEditor
        readOnly={!canWrite}
        productId={product.id}
        bom={product.bomItems.map((b) => ({
          id: b.id,
          componentId: b.componentId,
          qtyPerUnit: b.qtyPerUnit,
          sku: b.component.sku,
          name: b.component.name,
          unit: b.component.unit,
          stockQty: b.component.stockQty,
          unitCost: b.component.unitCost,
        }))}
        components={allComponents.map((c) => ({
          id: c.id,
          sku: c.sku,
          name: c.name,
          unit: c.unit,
          stockQty: c.stockQty,
          unitCost: c.unitCost,
        }))}
      />
    </>
  );
}
