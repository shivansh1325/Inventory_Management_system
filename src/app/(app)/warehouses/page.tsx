import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { requirePagePermission } from "@/lib/page-guard";
import { WarehousesClient } from "./warehouses-client";

export const dynamic = "force-dynamic";

export default async function WarehousesPage() {
  await requirePagePermission("warehouse.manage");
  const warehouses = await db.warehouse.findMany({
    include: { stockLevels: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Warehouses"
        subtitle="Stock locations — production consumes from one source warehouse per run"
        crumbs={[{ label: "Inventory" }, { label: "Warehouses" }]}
      />
      <WarehousesClient
        warehouses={warehouses.map((w) => ({
          id: w.id,
          code: w.code,
          name: w.name,
          isDefault: w.isDefault,
          isActive: w.isActive,
          itemCount: w.stockLevels.filter((l) => l.qty > 0).length,
        }))}
      />
    </>
  );
}
