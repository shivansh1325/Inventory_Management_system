/**
 * Integration tests for phase-2 flows. Run AFTER `npm run seed`
 * (consumes seeded data; re-run the seed to reset).
 *
 *   npx tsx scripts/flow-test.ts
 *
 * Covers: requisition approval limits, goods receipt updating stock through
 * the ledger, over-receipt rejection, warehouse transfer pairing.
 */
import { db } from "../src/lib/db";
import { toMilli } from "../src/lib/qty";
import { createRequisition, decideRequisition, receiveGoods } from "../src/lib/services/purchasing";
import { transferStock } from "../src/lib/services/transfer";
import type { SessionUser } from "../src/lib/auth";

async function sessionFor(email: string): Promise<SessionUser> {
  const u = await db.user.findUniqueOrThrow({ where: { email } });
  return { id: u.id, email: u.email, name: u.name, role: u.role as SessionUser["role"] };
}

async function main() {
  const admin = await sessionFor("admin@demo.local");
  const manager = await sessionFor("manager@demo.local");
  const store = await sessionFor("store@demo.local");
  const mainWh = await db.warehouse.findFirstOrThrow({ where: { code: "MAIN" } });
  const floorWh = await db.warehouse.findFirstOrThrow({ where: { code: "FLOOR" } });
  const fuse = await db.component.findFirstOrThrow({ where: { sku: "CMP-FUS-5A" } });
  const psu = await db.component.findFirstOrThrow({ where: { sku: "CMP-PSU-24V" } });

  // ---- 1. Manager approval limit ----
  const bigReq = await createRequisition({
    warehouseId: mainWh.id,
    lines: [{ componentId: psu.id, qtyMilli: toMilli("100") }], // 100 x 950 = 95,000 > 50,000 limit
    actor: store,
    submit: true,
  });
  let limited = false;
  try {
    await decideRequisition({ id: bigReq.id, approve: true, actor: manager });
  } catch (e) {
    limited = true;
    console.log("✓ Manager blocked above value limit:", (e as Error).message);
  }
  if (!limited) throw new Error("FAIL: manager approved above the limit");
  await decideRequisition({ id: bigReq.id, approve: true, comment: "ok", actor: admin });
  const approved = await db.purchaseRequisition.findUniqueOrThrow({ where: { id: bigReq.id } });
  if (approved.status !== "APPROVED") throw new Error("FAIL: admin approval did not stick");
  console.log("✓ Admin approved the same requisition");

  // ---- 2. Goods receipt updates stock via RECEIPT movements ----
  const req = await createRequisition({
    warehouseId: mainWh.id,
    lines: [{ componentId: fuse.id, qtyMilli: toMilli("50") }],
    actor: store,
    submit: true,
  });
  await decideRequisition({ id: req.id, approve: true, actor: manager }); // 50 x 4 = 200, below limit
  const beforeFuse = (await db.component.findUniqueOrThrow({ where: { id: fuse.id } })).stockQty;

  await receiveGoods({
    id: req.id,
    receipts: [{ lineId: req.lines[0].id, qtyMilli: toMilli("30") }],
    actor: store,
  });
  let after = await db.component.findUniqueOrThrow({ where: { id: fuse.id } });
  if (after.stockQty !== beforeFuse + toMilli("30")) throw new Error("FAIL: partial receipt did not add stock");
  let pr = await db.purchaseRequisition.findUniqueOrThrow({ where: { id: req.id }, include: { lines: true } });
  if (pr.status !== "ORDERED" || pr.lines[0].qtyReceived !== toMilli("30")) {
    throw new Error("FAIL: partial receipt state wrong");
  }
  console.log("✓ Partial goods receipt: +30 stock, status ORDERED, line tracks 30/50");

  // Over-receipt must be rejected.
  let overBlocked = false;
  try {
    await receiveGoods({
      id: req.id,
      receipts: [{ lineId: req.lines[0].id, qtyMilli: toMilli("999") }],
      actor: store,
    });
  } catch {
    overBlocked = true;
  }
  if (!overBlocked) throw new Error("FAIL: over-receipt was accepted");
  console.log("✓ Over-receipt rejected");

  await receiveGoods({
    id: req.id,
    receipts: [{ lineId: req.lines[0].id, qtyMilli: toMilli("20") }],
    actor: store,
  });
  pr = await db.purchaseRequisition.findUniqueOrThrow({ where: { id: req.id }, include: { lines: true } });
  if (pr.status !== "RECEIVED") throw new Error("FAIL: full receipt did not flip status to RECEIVED");
  const receiptMoves = await db.stockMovement.findMany({
    where: { refType: "PurchaseRequisition", refId: req.id, type: "RECEIPT" },
  });
  if (receiptMoves.length !== 2 || receiptMoves.reduce((s, m) => s + m.qtyChange, 0) !== toMilli("50")) {
    throw new Error("FAIL: receipt movements do not sum to 50");
  }
  console.log("✓ Full receipt: status RECEIVED, two RECEIPT movements sum to 50");

  // ---- 3. Transfer pairing ----
  const screw = await db.component.findFirstOrThrow({
    where: { sku: "CMP-SCR-M4" },
    include: { stockLevels: true },
  });
  const lvl = (whId: string, c: typeof screw) => c.stockLevels.find((l) => l.warehouseId === whId)?.qty ?? 0;
  const beforeTotal = screw.stockQty;
  const beforeMain = lvl(mainWh.id, screw);
  const beforeFloor = lvl(floorWh.id, screw);

  await transferStock({
    componentId: screw.id,
    fromWarehouseId: mainWh.id,
    toWarehouseId: floorWh.id,
    qtyMilli: toMilli("25"),
    createdBy: "flow-test",
  });
  const screwAfter = await db.component.findUniqueOrThrow({
    where: { id: screw.id },
    include: { stockLevels: true },
  });
  if (screwAfter.stockQty !== beforeTotal) throw new Error("FAIL: transfer changed the total");
  if (lvl(mainWh.id, screwAfter) !== beforeMain - toMilli("25")) throw new Error("FAIL: source level wrong");
  if (lvl(floorWh.id, screwAfter) !== beforeFloor + toMilli("25")) throw new Error("FAIL: destination level wrong");
  const pair = await db.stockMovement.findMany({
    where: { componentId: screw.id, type: { in: ["TRANSFER_OUT", "TRANSFER_IN"] } },
    orderBy: { createdAt: "desc" },
    take: 2,
  });
  if (pair.length !== 2 || pair[0].qtyChange + pair[1].qtyChange !== 0) {
    throw new Error("FAIL: transfer movements not paired ±25");
  }
  console.log("✓ Transfer: paired ±25 movements, levels shifted, total unchanged");

  // Insufficient source stock must fail atomically.
  let transferBlocked = false;
  const preFail = await db.component.findUniqueOrThrow({ where: { id: screw.id }, include: { stockLevels: true } });
  try {
    await transferStock({
      componentId: screw.id,
      fromWarehouseId: floorWh.id,
      toWarehouseId: mainWh.id,
      qtyMilli: toMilli("999999"),
    });
  } catch {
    transferBlocked = true;
  }
  const postFail = await db.component.findUniqueOrThrow({
    where: { id: screw.id },
    include: { stockLevels: true },
  });
  if (!transferBlocked) throw new Error("FAIL: oversized transfer accepted");
  if (postFail.stockQty !== preFail.stockQty) throw new Error("FAIL: failed transfer changed stock");
  console.log("✓ Oversized transfer blocked, nothing changed");

  // ---- Ledger reconciliation across everything ----
  for (const c of await db.component.findMany({ include: { stockLevels: true } })) {
    const sum = await db.stockMovement.aggregate({ where: { componentId: c.id }, _sum: { qtyChange: true } });
    if ((sum._sum.qtyChange ?? 0) !== c.stockQty) throw new Error(`FAIL: ledger mismatch ${c.sku}`);
    if (c.stockLevels.reduce((s, l) => s + l.qty, 0) !== c.stockQty) throw new Error(`FAIL: level mismatch ${c.sku}`);
  }
  console.log("✓ Ledger + warehouse levels reconcile after all flows");
  console.log("\nALL FLOW TESTS PASSED");
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
