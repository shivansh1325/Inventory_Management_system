import { db } from "@/lib/db";
import { mulQty, divFloor, fmtQty } from "@/lib/qty";
import { applyComponentDelta, GuardError } from "@/lib/services/stock-core";
import { withDocNumberRetry } from "@/lib/services/doc-number";
import { getSettings, getDefaultWarehouse } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { notifyByPermission } from "@/lib/notify";
import type { SessionUser } from "@/lib/auth";

/**
 * THE ONE RULE: a production run either deducts ALL required components
 * correctly, or deducts NOTHING. Everything here runs inside a single
 * interactive Prisma transaction; any throw rolls the whole run back.
 *
 * Phase 2: consumption is per-warehouse (StockLevel) with the component
 * total kept in sync in the same transaction. The negative-stock flag now
 * lives in AppSetting (Admin-configurable, OFF by default).
 */

export type Shortfall = {
  componentId: string;
  sku: string;
  name: string;
  unit: string;
  requiredMilli: number;
  availableMilli: number;
  shortfallMilli: number;
};

export type FeasibilityLine = Shortfall & { ok: boolean };

/** Feasibility table for producing qtyMilli of a product from a warehouse. Pure read. */
export async function checkFeasibility(productId: string, qtyMilli: number, warehouseId?: string) {
  const wh = warehouseId ?? (await getDefaultWarehouse()).id;
  const bom = await db.bomItem.findMany({
    where: { productId },
    include: { component: { include: { stockLevels: { where: { warehouseId: wh } } } } },
    orderBy: { component: { name: "asc" } },
  });
  const lines: FeasibilityLine[] = bom.map((b) => {
    const required = mulQty(b.qtyPerUnit, qtyMilli);
    const available = b.component.stockLevels[0]?.qty ?? 0;
    return {
      componentId: b.componentId,
      sku: b.component.sku,
      name: b.component.name,
      unit: b.component.unit,
      requiredMilli: required,
      availableMilli: available,
      shortfallMilli: Math.max(0, required - available),
      ok: available >= required,
    };
  });
  return { lines, feasible: lines.length > 0 && lines.every((l) => l.ok) };
}

/** Max whole units buildable = min over BOM of floor(warehouseStock/perUnit). */
export function buildableUnits(
  bom: { qtyPerUnit: number; available: number }[],
): number {
  if (bom.length === 0) return 0;
  return Math.min(...bom.map((b) => divFloor(b.available, b.qtyPerUnit)));
}

/** Convenience for total-stock buildable (single-warehouse view / product lists). */
export function buildableUnitsTotal(
  bom: { qtyPerUnit: number; component: { stockQty: number } }[],
): number {
  return buildableUnits(bom.map((b) => ({ qtyPerUnit: b.qtyPerUnit, available: b.component.stockQty })));
}

export class ShortfallError extends Error {
  constructor(public shortfalls: Shortfall[]) {
    super("Insufficient stock for production run");
  }
}

export async function completeProductionRun(opts: {
  productId: string;
  qtyMilli: number;
  warehouseId?: string;
  note?: string;
  actor?: SessionUser | null;
  createdBy?: string; // legacy callers (seed/tests) pass a plain name
}) {
  const { productId, qtyMilli, note, actor } = opts;
  const createdBy = actor?.name ?? opts.createdBy ?? null;
  if (qtyMilli <= 0) throw new Error("Production quantity must be positive");
  const settings = await getSettings();
  const warehouseId = opts.warehouseId ?? (await getDefaultWarehouse()).id;

  try {
    return await withDocNumberRetry("runNo", () => db.$transaction(async (tx) => {
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      if (!product.isActive) throw new Error("Product is archived");
      const bom = await tx.bomItem.findMany({
        where: { productId },
        include: { component: { include: { stockLevels: { where: { warehouseId } } } } },
      });
      if (bom.length === 0) {
        throw new Error("Product has no Bill of Materials — add BOM lines before producing");
      }

      // 1. Feasibility check inside the transaction (per source warehouse).
      const requirements = bom.map((b) => ({
        bomItem: b,
        available: b.component.stockLevels[0]?.qty ?? 0,
        required: mulQty(b.qtyPerUnit, qtyMilli),
      }));
      const shortfalls: Shortfall[] = requirements
        .filter((r) => r.available < r.required)
        .map((r) => ({
          componentId: r.bomItem.componentId,
          sku: r.bomItem.component.sku,
          name: r.bomItem.component.name,
          unit: r.bomItem.component.unit,
          requiredMilli: r.required,
          availableMilli: r.available,
          shortfallMilli: r.required - r.available,
        }));
      if (shortfalls.length > 0 && !settings.allowNegativeStock) {
        throw new ShortfallError(shortfalls);
      }

      // 2. Run number.
      const count = await tx.productionRun.count();
      const runNo = `PR-${String(count + 1).padStart(4, "0")}`;

      const run = await tx.productionRun.create({
        data: {
          runNo,
          productId,
          warehouseId,
          qtyToProduce: qtyMilli,
          status: "COMPLETED",
          note: note || null,
          producedAt: new Date(),
          createdBy,
        },
      });

      // 3. Deduct every component — applyComponentDelta re-guards at write time.
      for (const { bomItem, required } of requirements) {
        let totalAfter: number;
        try {
          const res = await applyComponentDelta(tx, {
            componentId: bomItem.componentId,
            warehouseId,
            deltaMilli: -required,
            allowNegative: settings.allowNegativeStock,
          });
          totalAfter = res.totalAfter;
        } catch (e) {
          if (e instanceof GuardError) {
            // Concurrent consumption between read and write — abort everything.
            throw new ShortfallError([
              {
                componentId: bomItem.componentId,
                sku: bomItem.component.sku,
                name: bomItem.component.name,
                unit: bomItem.component.unit,
                requiredMilli: required,
                availableMilli: e.availableMilli,
                shortfallMilli: required - e.availableMilli,
              },
            ]);
          }
          throw e;
        }
        await tx.stockMovement.create({
          data: {
            componentId: bomItem.componentId,
            warehouseId,
            type: "PRODUCTION_CONSUMPTION",
            qtyChange: -required,
            balanceAfter: totalAfter,
            refType: "ProductionRun",
            refId: run.id,
            createdBy,
          },
        });
        // 4. Snapshot — BOM edits later never rewrite this run's history.
        await tx.productionRunLine.create({
          data: {
            productionRunId: run.id,
            componentId: bomItem.componentId,
            qtyPerUnitSnapshot: bomItem.qtyPerUnit,
            qtyConsumed: required,
          },
        });
      }

      // 5. Finished goods up.
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { finishedStockQty: { increment: qtyMilli } },
      });
      await tx.stockMovement.create({
        data: {
          productId,
          type: "PRODUCTION_OUTPUT",
          qtyChange: qtyMilli,
          balanceAfter: updatedProduct.finishedStockQty,
          refType: "ProductionRun",
          refId: run.id,
          createdBy,
        },
      });

      return tx.productionRun.findUniqueOrThrow({
        where: { id: run.id },
        include: { lines: { include: { component: true } }, product: true },
      });
    }));
  } catch (e) {
    if (e instanceof ShortfallError) {
      // Stockout incident: log + alert purchasing. Outside the (rolled-back) tx.
      const product = await db.product.findUnique({ where: { id: productId } });
      await audit(actor ?? null, "run.blocked", "Product", productId, {
        product: product?.name,
        qty: qtyMilli,
        shortfalls: e.shortfalls.map((s) => ({ sku: s.sku, short: s.shortfallMilli })),
      });
      await notifyByPermission("purchasing.raise", {
        type: "RUN_BLOCKED",
        message: `Run blocked: ${product?.name ?? "product"} ×${fmtQty(qtyMilli)} — ${e.shortfalls.length} component(s) short`,
        href: "/production/new",
      });
    }
    throw e;
  }
}

/**
 * Reverse a COMPLETED run: restore every consumed component (into the run's
 * source warehouse) from the snapshot lines, remove the produced quantity
 * from finished stock, write RUN_REVERSAL movements, mark CANCELLED.
 */
export async function reverseProductionRun(runId: string, createdBy?: string) {
  const fallbackWh = (await getDefaultWarehouse()).id;
  return db.$transaction(async (tx) => {
    const run = await tx.productionRun.findUniqueOrThrow({
      where: { id: runId },
      include: { lines: true, product: true },
    });
    if (run.status !== "COMPLETED") {
      throw new Error(`Only COMPLETED runs can be reversed (run is ${run.status})`);
    }
    if (run.product.finishedStockQty < run.qtyToProduce) {
      throw new Error(
        "Finished stock is lower than this run's output — cannot reverse without going negative",
      );
    }
    const warehouseId = run.warehouseId ?? fallbackWh;

    for (const line of run.lines) {
      const { totalAfter } = await applyComponentDelta(tx, {
        componentId: line.componentId,
        warehouseId,
        deltaMilli: line.qtyConsumed,
      });
      await tx.stockMovement.create({
        data: {
          componentId: line.componentId,
          warehouseId,
          type: "RUN_REVERSAL",
          qtyChange: line.qtyConsumed,
          balanceAfter: totalAfter,
          refType: "ProductionRun",
          refId: run.id,
          reason: `Reversal of ${run.runNo}`,
          createdBy: createdBy || null,
        },
      });
    }

    const product = await tx.product.update({
      where: { id: run.productId },
      data: { finishedStockQty: { decrement: run.qtyToProduce } },
    });
    await tx.stockMovement.create({
      data: {
        productId: run.productId,
        type: "RUN_REVERSAL",
        qtyChange: -run.qtyToProduce,
        balanceAfter: product.finishedStockQty,
        refType: "ProductionRun",
        refId: run.id,
        reason: `Reversal of ${run.runNo}`,
        createdBy: createdBy || null,
      },
    });

    return tx.productionRun.update({
      where: { id: run.id },
      data: { status: "CANCELLED" },
    });
  });
}
