import { db } from "@/lib/db";
import { applyComponentDelta, GuardError } from "@/lib/services/stock-core";

/**
 * Warehouse transfer = paired TRANSFER_OUT / TRANSFER_IN movements in one
 * transaction. Component total is unchanged (−q then +q), so the ledger
 * total still reconciles; per-warehouse StockLevels shift.
 */
export async function transferStock(opts: {
  componentId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  qtyMilli: number;
  note?: string;
  createdBy?: string;
}) {
  const { componentId, fromWarehouseId, toWarehouseId, qtyMilli, note, createdBy } = opts;
  if (qtyMilli <= 0) throw new Error("Transfer quantity must be positive");
  if (fromWarehouseId === toWarehouseId) throw new Error("Source and destination are the same warehouse");

  return db.$transaction(async (tx) => {
    let outTotal: number;
    try {
      const res = await applyComponentDelta(tx, {
        componentId,
        warehouseId: fromWarehouseId,
        deltaMilli: -qtyMilli,
      });
      outTotal = res.totalAfter;
    } catch (e) {
      if (e instanceof GuardError) {
        throw new Error("Insufficient stock in source warehouse");
      }
      throw e;
    }
    await tx.stockMovement.create({
      data: {
        componentId,
        warehouseId: fromWarehouseId,
        type: "TRANSFER_OUT",
        qtyChange: -qtyMilli,
        balanceAfter: outTotal,
        reason: note || null,
        createdBy: createdBy || null,
      },
    });

    const { totalAfter } = await applyComponentDelta(tx, {
      componentId,
      warehouseId: toWarehouseId,
      deltaMilli: qtyMilli,
    });
    await tx.stockMovement.create({
      data: {
        componentId,
        warehouseId: toWarehouseId,
        type: "TRANSFER_IN",
        qtyChange: qtyMilli,
        balanceAfter: totalAfter,
        reason: note || null,
        createdBy: createdBy || null,
      },
    });
    return totalAfter;
  });
}
