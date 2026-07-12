import { db } from "@/lib/db";
import { applyComponentDelta } from "@/lib/services/stock-core";
import { notifyByPermission } from "@/lib/notify";
import { fmtQty } from "@/lib/qty";

/**
 * Stock changes ALWAYS write a StockMovement in the same transaction as the
 * quantity update — the ledger and the running balances can never diverge.
 * balanceAfter on movements is the component's TOTAL across warehouses;
 * per-warehouse balances live in StockLevel.
 */

async function lowStockAlert(componentId: string, beforeTotal: number, afterTotal: number) {
  if (afterTotal >= beforeTotal) return; // only on decreases
  const c = await db.component.findUnique({ where: { id: componentId } });
  if (!c || !(beforeTotal >= c.minLevel && afterTotal < c.minLevel)) return;
  await notifyByPermission("purchasing.raise", {
    type: "LOW_STOCK",
    message: `${c.name} dropped below min level (${fmtQty(afterTotal)}/${fmtQty(c.minLevel)} ${c.unit})`,
    href: "/reports",
  });
}

export async function receiveStock(opts: {
  componentId: string;
  warehouseId: string;
  qtyMilli: number; // > 0
  note?: string;
  refType?: string;
  refId?: string;
  createdBy?: string;
}) {
  const { componentId, warehouseId, qtyMilli, note, refType, refId, createdBy } = opts;
  if (qtyMilli <= 0) throw new Error("Receive quantity must be positive");

  return db.$transaction(async (tx) => {
    const { totalAfter } = await applyComponentDelta(tx, {
      componentId,
      warehouseId,
      deltaMilli: qtyMilli,
    });
    await tx.stockMovement.create({
      data: {
        componentId,
        warehouseId,
        type: "RECEIPT",
        qtyChange: qtyMilli,
        balanceAfter: totalAfter,
        refType: refType || null,
        refId: refId || null,
        reason: note || null,
        createdBy: createdBy || null,
      },
    });
    return totalAfter;
  });
}

export async function adjustStock(opts: {
  componentId: string;
  warehouseId: string;
  mode: "SET" | "DELTA";
  qtyMilli: number; // SET: new absolute WAREHOUSE value; DELTA: signed change
  reason: string;
  createdBy?: string;
}) {
  const { componentId, warehouseId, mode, qtyMilli, reason, createdBy } = opts;
  if (!reason.trim()) throw new Error("A reason is mandatory for adjustments");

  const result = await db.$transaction(async (tx) => {
    const level = await tx.stockLevel.upsert({
      where: { componentId_warehouseId: { componentId, warehouseId } },
      update: {},
      create: { componentId, warehouseId, qty: 0 },
    });
    const before = await tx.component.findUniqueOrThrow({ where: { id: componentId } });
    const targetWh = mode === "SET" ? qtyMilli : level.qty + qtyMilli;
    if (targetWh < 0) throw new Error("Adjustment would make warehouse stock negative");
    const delta = targetWh - level.qty;
    if (delta === 0) return { beforeTotal: before.stockQty, totalAfter: before.stockQty };

    const { totalAfter } = await applyComponentDelta(tx, {
      componentId,
      warehouseId,
      deltaMilli: delta,
      allowNegative: true, // target already validated >= 0 above
    });
    await tx.stockMovement.create({
      data: {
        componentId,
        warehouseId,
        type: "ADJUSTMENT",
        qtyChange: delta,
        balanceAfter: totalAfter,
        reason,
        createdBy: createdBy || null,
      },
    });
    return { beforeTotal: before.stockQty, totalAfter };
  });

  await lowStockAlert(componentId, result.beforeTotal, result.totalAfter);
  return result.totalAfter;
}

export { lowStockAlert };
