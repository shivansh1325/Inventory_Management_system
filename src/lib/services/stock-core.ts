import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * The single primitive every component-stock change goes through.
 * Inside the caller's transaction it:
 *   1. guards the per-warehouse StockLevel (no negative stock unless allowed)
 *   2. updates the StockLevel AND the component's cached total together
 * Returns the new balances. Throws GuardError when the guard fails, so the
 * caller's transaction rolls back untouched.
 */
export class GuardError extends Error {
  constructor(
    public componentId: string,
    public availableMilli: number,
    public requestedMilli: number,
  ) {
    super("Insufficient warehouse stock");
  }
}

export async function applyComponentDelta(
  tx: Tx,
  opts: {
    componentId: string;
    warehouseId: string;
    deltaMilli: number; // signed
    allowNegative?: boolean;
  },
): Promise<{ totalAfter: number; warehouseAfter: number }> {
  const { componentId, warehouseId, deltaMilli, allowNegative } = opts;

  const level = await tx.stockLevel.upsert({
    where: { componentId_warehouseId: { componentId, warehouseId } },
    update: {},
    create: { componentId, warehouseId, qty: 0 },
  });

  if (deltaMilli < 0 && !allowNegative) {
    // Conditional write = the concurrency guard. If another transaction
    // consumed this stock since any earlier read, count === 0 and we abort.
    const guarded = await tx.stockLevel.updateMany({
      where: { id: level.id, qty: { gte: -deltaMilli } },
      data: { qty: { increment: deltaMilli } },
    });
    if (guarded.count === 0) {
      throw new GuardError(componentId, level.qty, -deltaMilli);
    }
  } else {
    await tx.stockLevel.update({
      where: { id: level.id },
      data: { qty: { increment: deltaMilli } },
    });
  }

  const component = await tx.component.update({
    where: { id: componentId },
    data: { stockQty: { increment: deltaMilli } },
  });
  const after = await tx.stockLevel.findUniqueOrThrow({ where: { id: level.id } });
  return { totalAfter: component.stockQty, warehouseAfter: after.qty };
}
