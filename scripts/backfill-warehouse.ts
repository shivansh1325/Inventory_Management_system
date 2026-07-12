/**
 * One-time backfill after the phase-2 migration, for databases with
 * pre-warehouse data: creates "Main Warehouse", copies each component's
 * total stock into a StockLevel there, and stamps existing component
 * movements + runs with the warehouse id. Idempotent — safe to re-run.
 *
 *   npx tsx scripts/backfill-warehouse.ts
 */
import { db } from "../src/lib/db";

async function main() {
  const wh =
    (await db.warehouse.findFirst({ where: { isDefault: true } })) ??
    (await db.warehouse.create({
      data: { code: "MAIN", name: "Main Warehouse", isDefault: true },
    }));
  console.log(`Default warehouse: ${wh.name} (${wh.code})`);

  const components = await db.component.findMany({ include: { stockLevels: true } });
  let created = 0;
  for (const c of components) {
    if (c.stockLevels.length === 0) {
      await db.stockLevel.create({
        data: { componentId: c.id, warehouseId: wh.id, qty: c.stockQty },
      });
      created++;
    }
  }
  const movements = await db.stockMovement.updateMany({
    where: { componentId: { not: null }, warehouseId: null },
    data: { warehouseId: wh.id },
  });
  const runs = await db.productionRun.updateMany({
    where: { warehouseId: null },
    data: { warehouseId: wh.id },
  });
  console.log(
    `Backfilled: ${created} stock levels, ${movements.count} movements, ${runs.count} runs`,
  );

  // Sanity: per-warehouse sums must equal component totals.
  for (const c of await db.component.findMany({ include: { stockLevels: true } })) {
    const sum = c.stockLevels.reduce((s, l) => s + l.qty, 0);
    if (sum !== c.stockQty) throw new Error(`Mismatch for ${c.sku}: levels ${sum} vs total ${c.stockQty}`);
  }
  console.log("✓ StockLevels reconcile with component totals");
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
