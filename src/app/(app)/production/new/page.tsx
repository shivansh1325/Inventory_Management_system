import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { NewRunWizard, type WizardProduct, type WizardWarehouse } from "./new-run-client";

export const dynamic = "force-dynamic";

export default async function NewRunPage({
  searchParams,
}: {
  searchParams: { productId?: string };
}) {
  const user = await requireUser();
  const [products, warehouses] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      include: {
        bomItems: {
          include: { component: { include: { stockLevels: true } } },
          orderBy: { component: { name: "asc" } },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const data: WizardProduct[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description,
    unit: p.unit,
    finishedStockQty: p.finishedStockQty,
    bom: p.bomItems.map((b) => ({
      componentId: b.componentId,
      sku: b.component.sku,
      name: b.component.name,
      unit: b.component.unit,
      qtyPerUnit: b.qtyPerUnit,
      unitCost: b.component.unitCost,
      levels: Object.fromEntries(b.component.stockLevels.map((l) => [l.warehouseId, l.qty])),
    })),
  }));

  const whs: WizardWarehouse[] = warehouses.map((w) => ({
    id: w.id,
    name: w.name,
    isDefault: w.isDefault,
  }));

  return (
    <>
      <PageHeader
        title="New production run"
        subtitle="Three steps: product → quantity & feasibility → review. Nothing is deducted until you confirm."
        crumbs={[{ label: "Operations" }, { label: "Production", href: "/production" }, { label: "New run" }]}
      />
      <NewRunWizard
        products={data}
        warehouses={whs}
        initialProductId={searchParams.productId}
        canRaiseRequisition={can(user.role, "purchasing.raise")}
      />
    </>
  );
}
