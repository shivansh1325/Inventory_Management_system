import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { requirePagePermission } from "@/lib/page-guard";
import { NewRequisitionClient } from "./new-requisition-client";

export const dynamic = "force-dynamic";

export default async function NewRequisitionPage({
  searchParams,
}: {
  searchParams: { componentId?: string };
}) {
  await requirePagePermission("purchasing.raise");
  const [components, warehouses, suppliers] = await Promise.all([
    db.component.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="New purchase requisition"
        subtitle="Draft first or submit straight for approval"
        crumbs={[{ label: "Operations" }, { label: "Purchasing", href: "/purchasing" }, { label: "New" }]}
      />
      <NewRequisitionClient
        components={components.map((c) => ({
          id: c.id,
          name: c.name,
          sku: c.sku,
          unit: c.unit,
          stockQty: c.stockQty,
          minLevel: c.minLevel,
          unitCost: c.unitCost,
        }))}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault }))}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        initialComponentId={searchParams.componentId}
      />
    </>
  );
}
