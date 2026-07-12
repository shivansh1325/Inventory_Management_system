"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, AuthError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toMilli } from "@/lib/qty";
import { transferSchema } from "@/lib/validation";
import { transferStock } from "@/lib/services/transfer";

type Result = { ok: boolean; error?: string };
const fail = (error: string): Result => ({ ok: false, error });

export async function transferStockAction(raw: unknown): Promise<Result> {
  try {
    const actor = await requirePermission("warehouse.transfer");
    const parsed = transferSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    await transferStock({
      componentId: parsed.data.componentId,
      fromWarehouseId: parsed.data.fromWarehouseId,
      toWarehouseId: parsed.data.toWarehouseId,
      qtyMilli: toMilli(parsed.data.qty),
      note: parsed.data.note || undefined,
      createdBy: actor.name,
    });
    await audit(actor, "stock.transfer", "Component", parsed.data.componentId, {
      from: parsed.data.fromWarehouseId,
      to: parsed.data.toWarehouseId,
      qty: parsed.data.qty,
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message);
    return fail(e instanceof Error ? e.message : "Transfer failed");
  }
}
