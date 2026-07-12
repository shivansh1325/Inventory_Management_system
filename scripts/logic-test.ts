/**
 * Integration test for the auto-deduction engine. Run AFTER `npm run seed`
 * (it consumes seeded stock; re-run the seed to reset).
 *
 *   npx tsx scripts/logic-test.ts
 *
 * Exercises: shortfall block (nothing deducted), reversal restore,
 * concurrency guard (two racing runs, stock for only one), ledger reconciliation.
 */
import { db } from "../src/lib/db";
import { toMilli } from "../src/lib/qty";
import {
  completeProductionRun,
  reverseProductionRun,
  ShortfallError,
} from "../src/lib/services/production";

async function snapshot() {
  const cs = await db.component.findMany({ orderBy: { sku: "asc" } });
  return new Map(cs.map((c) => [c.sku, c.stockQty]));
}

async function main() {
  const cp = await db.product.findFirstOrThrow({ where: { sku: "PRD-CTRL-PNL" } });

  // 1. Shortfall: PCB stock is 30 after seed -> 40 panels need 40 PCBs. Must block, deduct nothing.
  const before = await snapshot();
  let blocked = false;
  try {
    await completeProductionRun({ productId: cp.id, qtyMilli: toMilli("40") });
  } catch (e) {
    if (e instanceof ShortfallError) {
      blocked = true;
      console.log("✓ Shortfall block:", e.shortfalls.map((s) => `${s.sku} short ${s.shortfallMilli}`).join(", "));
    } else throw e;
  }
  if (!blocked) throw new Error("FAIL: run should have been blocked");
  const after = await snapshot();
  for (const [sku, qty] of before) {
    if (after.get(sku) !== qty) throw new Error(`FAIL: stock changed for ${sku} despite block`);
  }
  console.log("✓ Nothing deducted on blocked run");

  // 2. Complete a small run, then reverse it — stock must return exactly.
  const pre = await snapshot();
  const preFinished = (await db.product.findUniqueOrThrow({ where: { id: cp.id } })).finishedStockQty;
  const run = await completeProductionRun({ productId: cp.id, qtyMilli: toMilli("2"), note: "test" });
  console.log(`✓ Completed ${run.runNo} (2 units)`);
  await reverseProductionRun(run.id);
  const post = await snapshot();
  for (const [sku, qty] of pre) {
    if (post.get(sku) !== qty) throw new Error(`FAIL: ${sku} not restored after reversal`);
  }
  const postFinished = (await db.product.findUniqueOrThrow({ where: { id: cp.id } })).finishedStockQty;
  if (postFinished !== preFinished) throw new Error("FAIL: finished stock not restored");
  const status = (await db.productionRun.findUniqueOrThrow({ where: { id: run.id } })).status;
  if (status !== "CANCELLED") throw new Error("FAIL: run not CANCELLED");
  console.log("✓ Reversal restored all component stock + finished stock; run CANCELLED");

  // 3. Concurrency: two simultaneous runs where stock suffices for one only.
  // PCB stock = 30 -> two runs of 20 panels each: exactly one must succeed.
  const results = await Promise.allSettled([
    completeProductionRun({ productId: cp.id, qtyMilli: toMilli("20"), note: "race A" }),
    completeProductionRun({ productId: cp.id, qtyMilli: toMilli("20"), note: "race B" }),
  ]);
  const okCount = results.filter((r) => r.status === "fulfilled").length;
  console.log(`  race results: ${results.map((r) => r.status).join(", ")}`);
  if (okCount !== 1) throw new Error(`FAIL: expected exactly 1 winner, got ${okCount}`);
  const pcb = await db.component.findFirstOrThrow({ where: { sku: "CMP-PCB-01" } });
  if (pcb.stockQty !== toMilli("10")) throw new Error(`FAIL: PCB stock ${pcb.stockQty}, expected 10000`);
  console.log("✓ Concurrency: exactly one of two racing runs succeeded, stock never negative");

  // Ledger reconciliation after all of it.
  for (const c of await db.component.findMany()) {
    const sum = await db.stockMovement.aggregate({ where: { componentId: c.id }, _sum: { qtyChange: true } });
    if ((sum._sum.qtyChange ?? 0) !== c.stockQty) throw new Error(`FAIL: ledger mismatch ${c.sku}`);
  }
  console.log("✓ Ledger still reconciles after block + reversal + race");
  console.log("\nALL LOGIC TESTS PASSED");
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
