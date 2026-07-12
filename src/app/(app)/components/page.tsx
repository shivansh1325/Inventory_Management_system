import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ComponentsClient, type ComponentRow } from "./components-client";

export const dynamic = "force-dynamic";

export default async function ComponentsPage() {
  const user = await requireUser();
  const [components, warehouses] = await Promise.all([
    db.component.findMany({ orderBy: { name: "asc" } }),
    db.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const rows: ComponentRow[] = components.map((c) => ({
    id: c.id,
    sku: c.sku,
    name: c.name,
    unit: c.unit,
    stockQty: c.stockQty,
    minLevel: c.minLevel,
    unitCost: c.unitCost,
    location: c.location,
    supplier: c.supplier,
    category: c.category,
    isActive: c.isActive,
  }));

  return (
    <>
      <PageHeader
        title="Components / Stock"
        subtitle="Raw materials and parts — current stock, receipts and corrections"
        crumbs={[{ label: "Inventory" }, { label: "Components" }]}
      />
      <ComponentsClient
        rows={rows}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault }))}
        perms={{
          write: can(user.role, "components.write"),
          archive: can(user.role, "components.archive"),
          receive: can(user.role, "stock.receive"),
          adjust: can(user.role, "stock.adjust"),
          export: can(user.role, "export.data"),
        }}
      />
    </>
  );
}
