"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { toMilli, fmtQty } from "@/lib/qty";
import {
  componentSchema,
  productSchema,
  bomItemSchema,
  receiveStockSchema,
  adjustStockSchema,
  productionRunSchema,
} from "@/lib/validation";
import { receiveStock, adjustStock } from "@/lib/services/stock";
import {
  completeProductionRun,
  reverseProductionRun,
  ShortfallError,
  type Shortfall,
} from "@/lib/services/production";
import { requirePermission, AuthError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getDefaultWarehouse } from "@/lib/settings";

export type ActionResult = {
  ok: boolean;
  error?: string;
  shortfalls?: (Shortfall & { requiredLabel: string; availableLabel: string; shortLabel: string })[];
  runNo?: string;
  runId?: string;
};

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function isUniqueError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function authFail(e: unknown): ActionResult | null {
  return e instanceof AuthError ? fail(e.message) : null;
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

// ---------- Components ----------

export async function saveComponent(id: string | null, raw: unknown): Promise<ActionResult> {
  try {
    const actor = await requirePermission("components.write");
    const parsed = componentSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const d = parsed.data;
    const data = {
      sku: d.sku,
      name: d.name,
      unit: d.unit,
      minLevel: toMilli(d.minLevel),
      unitCost: d.unitCost ? toMilli(d.unitCost) : null,
      location: d.location || null,
      supplier: d.supplier || null,
      category: (d as { category?: string }).category || null,
    };
    try {
      if (id) {
        await db.component.update({ where: { id }, data });
        await audit(actor, "component.update", "Component", id, { sku: d.sku });
      } else {
        const created = await db.component.create({ data });
        await audit(actor, "component.create", "Component", created.id, { sku: d.sku });
      }
    } catch (e) {
      if (isUniqueError(e)) return fail(`SKU "${d.sku}" already exists`);
      throw e;
    }
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

/** Archive instead of delete — history-bearing components must stay auditable. */
export async function setComponentActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    const actor = await requirePermission("components.archive");
    const c = await db.component.update({ where: { id }, data: { isActive: active } });
    await audit(actor, active ? "component.restore" : "component.archive", "Component", id, {
      sku: c.sku,
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

export async function receiveStockAction(raw: unknown): Promise<ActionResult> {
  try {
    const actor = await requirePermission("stock.receive");
    const parsed = receiveStockSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const warehouseId = parsed.data.warehouseId || (await getDefaultWarehouse()).id;
    await receiveStock({
      componentId: parsed.data.componentId,
      warehouseId,
      qtyMilli: toMilli(parsed.data.qty),
      note: parsed.data.note || undefined,
      createdBy: actor.name,
    });
    await audit(actor, "stock.receive", "Component", parsed.data.componentId, {
      qty: parsed.data.qty,
      warehouseId,
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

export async function adjustStockAction(raw: unknown): Promise<ActionResult> {
  try {
    const actor = await requirePermission("stock.adjust");
    const parsed = adjustStockSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const warehouseId = parsed.data.warehouseId || (await getDefaultWarehouse()).id;
    const before = await db.stockLevel.findUnique({
      where: { componentId_warehouseId: { componentId: parsed.data.componentId, warehouseId } },
    });
    await adjustStock({
      componentId: parsed.data.componentId,
      warehouseId,
      mode: parsed.data.mode,
      qtyMilli: toMilli(parsed.data.qty),
      reason: parsed.data.reason,
      createdBy: actor.name,
    });
    await audit(actor, "stock.adjust", "Component", parsed.data.componentId, {
      mode: parsed.data.mode,
      qty: parsed.data.qty,
      reason: parsed.data.reason,
      warehouseBefore: before ? fmtQty(before.qty) : "0",
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Adjustment failed");
  }
}

// ---------- Products & BOM ----------

export async function saveProduct(id: string | null, raw: unknown): Promise<ActionResult> {
  try {
    const actor = await requirePermission("products.write");
    const parsed = productSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const d = parsed.data;
    const data = { sku: d.sku, name: d.name, description: d.description || null, unit: d.unit };
    try {
      if (id) {
        await db.product.update({ where: { id }, data });
        await audit(actor, "product.update", "Product", id, { sku: d.sku });
      } else {
        const created = await db.product.create({ data });
        await audit(actor, "product.create", "Product", created.id, { sku: d.sku });
      }
    } catch (e) {
      if (isUniqueError(e)) return fail(`SKU "${d.sku}" already exists`);
      throw e;
    }
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

export async function setProductActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    const actor = await requirePermission("products.write");
    const p = await db.product.update({ where: { id }, data: { isActive: active } });
    await audit(actor, active ? "product.restore" : "product.archive", "Product", id, { sku: p.sku });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

export async function addBomItem(raw: unknown): Promise<ActionResult> {
  try {
    const actor = await requirePermission("products.write");
    const parsed = bomItemSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    try {
      await db.bomItem.create({
        data: {
          productId: parsed.data.productId,
          componentId: parsed.data.componentId,
          qtyPerUnit: toMilli(parsed.data.qtyPerUnit),
        },
      });
      await audit(actor, "bom.add", "Product", parsed.data.productId, {
        componentId: parsed.data.componentId,
        qtyPerUnit: parsed.data.qtyPerUnit,
      });
    } catch (e) {
      if (isUniqueError(e)) return fail("That component is already in this BOM — edit its quantity instead");
      throw e;
    }
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

export async function updateBomItem(id: string, qtyPerUnit: string): Promise<ActionResult> {
  try {
    const actor = await requirePermission("products.write");
    if (!/^\d+(\.\d{1,3})?$/.test(qtyPerUnit.trim()) || parseFloat(qtyPerUnit) <= 0) {
      return fail("Quantity per unit must be a positive number (max 3 decimals)");
    }
    const item = await db.bomItem.update({
      where: { id },
      data: { qtyPerUnit: toMilli(qtyPerUnit.trim()) },
    });
    await audit(actor, "bom.update", "Product", item.productId, { bomItemId: id, qtyPerUnit });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

export async function removeBomItem(id: string): Promise<ActionResult> {
  try {
    const actor = await requirePermission("products.write");
    const item = await db.bomItem.delete({ where: { id } });
    await audit(actor, "bom.remove", "Product", item.productId, { componentId: item.componentId });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

// ---------- Production ----------

export async function createProductionRun(raw: unknown): Promise<ActionResult> {
  try {
    const actor = await requirePermission("runs.create");
    const parsed = productionRunSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    try {
      const run = await completeProductionRun({
        productId: parsed.data.productId,
        qtyMilli: toMilli(parsed.data.qty),
        warehouseId: (raw as { warehouseId?: string }).warehouseId || undefined,
        note: parsed.data.note || undefined,
        actor,
      });
      await audit(actor, "run.complete", "ProductionRun", run.id, {
        runNo: run.runNo,
        qty: parsed.data.qty,
      });
      revalidateAll();
      return { ok: true, runNo: run.runNo, runId: run.id };
    } catch (e) {
      if (e instanceof ShortfallError) {
        return {
          ok: false,
          error: "Insufficient stock — nothing was deducted",
          shortfalls: e.shortfalls.map((s) => ({
            ...s,
            requiredLabel: `${fmtQty(s.requiredMilli)} ${s.unit}`,
            availableLabel: `${fmtQty(s.availableMilli)} ${s.unit}`,
            shortLabel: `${fmtQty(s.shortfallMilli)} ${s.unit}`,
          })),
        };
      }
      return fail(e instanceof Error ? e.message : "Production run failed");
    }
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

export async function reverseRunAction(runId: string): Promise<ActionResult> {
  try {
    const actor = await requirePermission("runs.reverse");
    const run = await reverseProductionRun(runId, actor.name);
    await audit(actor, "run.reverse", "ProductionRun", runId, { runNo: run.runNo });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Reversal failed");
  }
}
