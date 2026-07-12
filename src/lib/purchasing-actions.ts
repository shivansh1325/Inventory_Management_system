"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, AuthError } from "@/lib/auth";
import { toMilli } from "@/lib/qty";
import { requisitionSchema } from "@/lib/validation";
import {
  createRequisition,
  submitRequisition,
  decideRequisition,
  markOrdered,
  receiveGoods,
  closeRequisition,
} from "@/lib/services/purchasing";

type Result = { ok: boolean; error?: string; requisitionId?: string; prNo?: string };
const fail = (error: string): Result => ({ ok: false, error });
const authFail = (e: unknown): Result | null => (e instanceof AuthError ? fail(e.message) : null);
const revalidate = () => revalidatePath("/", "layout");

export async function createRequisitionAction(raw: unknown): Promise<Result> {
  try {
    const actor = await requirePermission("purchasing.raise");
    const parsed = requisitionSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const pr = await createRequisition({
      warehouseId: parsed.data.warehouseId,
      supplierId: parsed.data.supplierId || null,
      note: parsed.data.note || undefined,
      lines: parsed.data.lines.map((l) => ({
        componentId: l.componentId,
        qtyMilli: toMilli(l.qty),
      })),
      actor,
      submit: parsed.data.submit,
    });
    revalidate();
    return { ok: true, requisitionId: pr.id, prNo: pr.prNo };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

export async function submitRequisitionAction(id: string): Promise<Result> {
  try {
    const actor = await requirePermission("purchasing.raise");
    await submitRequisition(id, actor);
    revalidate();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

export async function decideRequisitionAction(
  id: string,
  approve: boolean,
  comment?: string,
): Promise<Result> {
  try {
    const actor = await requirePermission("purchasing.approve");
    await decideRequisition({ id, approve, comment, actor });
    revalidate();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

export async function markOrderedAction(id: string): Promise<Result> {
  try {
    const actor = await requirePermission("purchasing.receive");
    await markOrdered(id, actor);
    revalidate();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

export async function receiveGoodsAction(
  id: string,
  receipts: { lineId: string; qty: string }[],
): Promise<Result> {
  try {
    const actor = await requirePermission("purchasing.receive");
    const parsed = receipts
      .filter((r) => r.qty.trim() !== "" && parseFloat(r.qty) > 0)
      .map((r) => {
        if (!/^\d+(\.\d{1,3})?$/.test(r.qty.trim())) {
          throw new Error("Receipt quantities must be numbers (max 3 decimals)");
        }
        return { lineId: r.lineId, qtyMilli: toMilli(r.qty.trim()) };
      });
    await receiveGoods({ id, receipts: parsed, actor });
    revalidate();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

export async function closeRequisitionAction(id: string): Promise<Result> {
  try {
    const actor = await requirePermission("purchasing.approve");
    await closeRequisition(id, actor);
    revalidate();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}
