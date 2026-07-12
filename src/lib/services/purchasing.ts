import { db } from "@/lib/db";
import { mulQty, fmtQty } from "@/lib/qty";
import { receiveStock } from "@/lib/services/stock";
import { getSettings } from "@/lib/settings";
import { canApproveValue } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { notifyByPermission, notifyUser } from "@/lib/notify";
import type { SessionUser } from "@/lib/auth";

export const PR_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "ORDERED",
  "RECEIVED",
  "CLOSED",
] as const;
export type PrStatus = (typeof PR_STATUSES)[number];

export function requisitionValue(lines: { qtyRequested: number; estUnitCost: number | null }[]) {
  return lines.reduce(
    (sum, l) => sum + (l.estUnitCost != null ? mulQty(l.qtyRequested, l.estUnitCost) : 0),
    0,
  );
}

export async function createRequisition(opts: {
  warehouseId: string;
  supplierId?: string | null;
  note?: string;
  lines: { componentId: string; qtyMilli: number }[];
  actor: SessionUser;
  submit?: boolean; // true = straight to PENDING_APPROVAL
}) {
  const { warehouseId, supplierId, note, lines, actor, submit } = opts;
  if (lines.length === 0) throw new Error("A requisition needs at least one line");
  if (lines.some((l) => l.qtyMilli <= 0)) throw new Error("Line quantities must be positive");

  const components = await db.component.findMany({
    where: { id: { in: lines.map((l) => l.componentId) } },
  });
  const costById = new Map(components.map((c) => [c.id, c.unitCost]));

  const pr = await db.$transaction(async (tx) => {
    const count = await tx.purchaseRequisition.count();
    const prNo = `REQ-${String(count + 1).padStart(4, "0")}`;
    return tx.purchaseRequisition.create({
      data: {
        prNo,
        status: submit ? "PENDING_APPROVAL" : "DRAFT",
        warehouseId,
        supplierId: supplierId || null,
        note: note || null,
        raisedById: actor.id,
        raisedByName: actor.name,
        lines: {
          create: lines.map((l) => ({
            componentId: l.componentId,
            qtyRequested: l.qtyMilli,
            estUnitCost: costById.get(l.componentId) ?? null,
          })),
        },
      },
      include: { lines: true },
    });
  });

  await audit(actor, "requisition.create", "PurchaseRequisition", pr.id, {
    prNo: pr.prNo,
    lines: lines.length,
    submitted: !!submit,
  });
  if (submit) {
    await notifyByPermission(
      "purchasing.approve",
      {
        type: "PR_PENDING",
        message: `${pr.prNo} awaits approval (raised by ${actor.name})`,
        href: `/purchasing/${pr.id}`,
      },
      actor.id,
    );
  }
  return pr;
}

export async function submitRequisition(id: string, actor: SessionUser) {
  const pr = await db.purchaseRequisition.findUniqueOrThrow({ where: { id }, include: { lines: true } });
  if (pr.status !== "DRAFT") throw new Error(`Only DRAFT requisitions can be submitted (is ${pr.status})`);
  if (pr.lines.length === 0) throw new Error("Add at least one line before submitting");
  await db.purchaseRequisition.update({ where: { id }, data: { status: "PENDING_APPROVAL" } });
  await audit(actor, "requisition.submit", "PurchaseRequisition", id, { prNo: pr.prNo });
  await notifyByPermission(
    "purchasing.approve",
    { type: "PR_PENDING", message: `${pr.prNo} awaits approval`, href: `/purchasing/${id}` },
    actor.id,
  );
}

export async function decideRequisition(opts: {
  id: string;
  approve: boolean;
  comment?: string;
  actor: SessionUser;
}) {
  const { id, approve, comment, actor } = opts;
  const pr = await db.purchaseRequisition.findUniqueOrThrow({
    where: { id },
    include: { lines: true },
  });
  if (pr.status !== "PENDING_APPROVAL") {
    throw new Error(`Requisition is ${pr.status}, not awaiting approval`);
  }
  const value = requisitionValue(pr.lines);
  const settings = await getSettings();
  if (approve && !canApproveValue(actor.role, value, settings.managerApprovalLimit)) {
    throw new Error(
      `Value ${fmtQty(value)} exceeds your approval limit — escalate to an Admin`,
    );
  }

  await db.purchaseRequisition.update({
    where: { id },
    data: {
      status: approve ? "APPROVED" : "REJECTED",
      decidedById: actor.id,
      decidedByName: actor.name,
      decidedAt: new Date(),
      decisionComment: comment || null,
    },
  });
  await audit(actor, approve ? "requisition.approve" : "requisition.reject", "PurchaseRequisition", id, {
    prNo: pr.prNo,
    value,
    comment,
  });
  if (pr.raisedById) {
    await notifyUser(pr.raisedById, {
      type: "PR_DECIDED",
      message: `${pr.prNo} was ${approve ? "approved" : "rejected"} by ${actor.name}`,
      href: `/purchasing/${id}`,
    });
  }
}

export async function markOrdered(id: string, actor: SessionUser) {
  const pr = await db.purchaseRequisition.findUniqueOrThrow({ where: { id } });
  if (pr.status !== "APPROVED") throw new Error(`Only APPROVED requisitions can be marked ordered`);
  await db.purchaseRequisition.update({ where: { id }, data: { status: "ORDERED" } });
  await audit(actor, "requisition.order", "PurchaseRequisition", id, { prNo: pr.prNo });
}

/**
 * Goods receipt against an approved/ordered requisition. Partial receipts
 * supported — each nonzero line becomes a RECEIPT movement (existing ledger)
 * into the requisition's warehouse. Status flips to RECEIVED when every line
 * is fully received.
 */
export async function receiveGoods(opts: {
  id: string;
  receipts: { lineId: string; qtyMilli: number }[];
  actor: SessionUser;
}) {
  const { id, receipts, actor } = opts;
  const pr = await db.purchaseRequisition.findUniqueOrThrow({
    where: { id },
    include: { lines: { include: { component: true } } },
  });
  if (!["APPROVED", "ORDERED"].includes(pr.status)) {
    throw new Error(`Goods can only be received against APPROVED/ORDERED requisitions (is ${pr.status})`);
  }
  const nonzero = receipts.filter((r) => r.qtyMilli > 0);
  if (nonzero.length === 0) throw new Error("Nothing to receive");

  for (const r of nonzero) {
    const line = pr.lines.find((l) => l.id === r.lineId);
    if (!line) throw new Error("Unknown requisition line");
    const outstanding = line.qtyRequested - line.qtyReceived;
    if (r.qtyMilli > outstanding) {
      throw new Error(
        `${line.component.name}: receiving ${fmtQty(r.qtyMilli)} exceeds outstanding ${fmtQty(outstanding)}`,
      );
    }
  }

  // Stock + line updates. Each line's receipt is itself transactional
  // (movement + level + total together via receiveStock).
  for (const r of nonzero) {
    const line = pr.lines.find((l) => l.id === r.lineId)!;
    await receiveStock({
      componentId: line.componentId,
      warehouseId: pr.warehouseId,
      qtyMilli: r.qtyMilli,
      note: `Goods receipt ${pr.prNo}`,
      refType: "PurchaseRequisition",
      refId: pr.id,
      createdBy: actor.name,
    });
    await db.purchaseRequisitionLine.update({
      where: { id: r.lineId },
      data: { qtyReceived: { increment: r.qtyMilli } },
    });
  }

  const updated = await db.purchaseRequisition.findUniqueOrThrow({
    where: { id },
    include: { lines: true },
  });
  const fullyReceived = updated.lines.every((l) => l.qtyReceived >= l.qtyRequested);
  await db.purchaseRequisition.update({
    where: { id },
    data: { status: fullyReceived ? "RECEIVED" : "ORDERED" },
  });
  await audit(actor, "requisition.receive", "PurchaseRequisition", id, {
    prNo: pr.prNo,
    receipts: nonzero.map((r) => ({ lineId: r.lineId, qty: r.qtyMilli })),
    fullyReceived,
  });
  if (pr.raisedById && pr.raisedById !== actor.id) {
    await notifyUser(pr.raisedById, {
      type: "PR_DECIDED",
      message: `${pr.prNo}: goods ${fullyReceived ? "fully" : "partially"} received`,
      href: `/purchasing/${id}`,
    });
  }
  return fullyReceived;
}

export async function closeRequisition(id: string, actor: SessionUser) {
  const pr = await db.purchaseRequisition.findUniqueOrThrow({ where: { id } });
  if (!["RECEIVED", "REJECTED", "ORDERED", "APPROVED", "DRAFT"].includes(pr.status)) {
    throw new Error("Requisition is already closed");
  }
  await db.purchaseRequisition.update({ where: { id }, data: { status: "CLOSED" } });
  await audit(actor, "requisition.close", "PurchaseRequisition", id, { prNo: pr.prNo });
}
