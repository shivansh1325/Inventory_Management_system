/**
 * Seed v2: realistic demo data for the enterprise build.
 * Stock is populated through the SAME service functions the app uses
 * (receiveStock / completeProductionRun / transferStock / purchasing), so the
 * movement ledger, per-warehouse levels, and running balances reconcile from
 * the very first row.
 *
 * Demo logins (all password "demo1234"):
 *   admin@demo.local    — Admin
 *   manager@demo.local  — Production Manager
 *   store@demo.local    — Store Keeper
 *   operator@demo.local — Operator
 */
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { toMilli, fmtQty } from "../src/lib/qty";
import { receiveStock } from "../src/lib/services/stock";
import { completeProductionRun } from "../src/lib/services/production";
import { transferStock } from "../src/lib/services/transfer";
import { createRequisition, decideRequisition, receiveGoods } from "../src/lib/services/purchasing";
import type { SessionUser } from "../src/lib/auth";

async function main() {
  console.log("Clearing existing data…");
  await db.notification.deleteMany();
  await db.auditLog.deleteMany();
  await db.purchaseRequisitionLine.deleteMany();
  await db.purchaseRequisition.deleteMany();
  await db.supplier.deleteMany();
  await db.stockMovement.deleteMany();
  await db.productionRunLine.deleteMany();
  await db.productionRun.deleteMany();
  await db.bomItem.deleteMany();
  await db.product.deleteMany();
  await db.stockLevel.deleteMany();
  await db.component.deleteMany();
  await db.warehouse.deleteMany();
  await db.user.deleteMany();
  await db.appSetting.deleteMany();

  console.log("Settings, warehouses, users…");
  await db.appSetting.create({
    data: { id: "singleton", companyName: "Powrio", currency: "₹", managerApprovalLimit: toMilli("50000") },
  });

  const main = await db.warehouse.create({
    data: { code: "MAIN", name: "Main Warehouse", isDefault: true },
  });
  const floor = await db.warehouse.create({
    data: { code: "FLOOR", name: "Assembly Floor Store" },
  });

  const hash = await bcrypt.hash("demo1234", 10);
  const mkUser = (name: string, email: string, role: string) =>
    db.user.create({ data: { name, email, role, passwordHash: hash } });
  const admin = await mkUser("Asha Admin", "admin@demo.local", "ADMIN");
  const manager = await mkUser("Manoj Manager", "manager@demo.local", "MANAGER");
  const store = await mkUser("Sana Store", "store@demo.local", "STORE");
  await mkUser("Omar Operator", "operator@demo.local", "OPERATOR");

  const asSession = (u: { id: string; email: string; name: string; role: string }): SessionUser => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as SessionUser["role"],
  });

  console.log("Suppliers…");
  const supplierRows = [
    ["FastenCo", "Ravi", "sales@fastenco.example", "Net 30", 4],
    ["PCB Works", "Lin", "orders@pcbworks.example", "Net 45", 12],
    ["MetalForm", "Dieter", "dieter@metalform.example", "Net 30", 10],
    ["ElectroSupply", "Priya", "priya@electrosupply.example", "Net 15", 5],
    ["SealTech", "Kenji", "kenji@sealtech.example", "Net 30", 7],
  ] as const;
  const suppliers = new Map<string, string>();
  for (const [name, contact, email, terms, leadTimeDays] of supplierRows) {
    const s = await db.supplier.create({ data: { name, contact, email, terms, leadTimeDays } });
    suppliers.set(name, s.id);
  }

  console.log("Components…");
  // [sku, name, unit, category, minLevel, unitCost, receiveQty, location, supplier]
  const componentData: [string, string, string, string, string, string, string, string, string][] = [
    ["CMP-SCR-M4",  "M4 Screw 12mm",       "pcs", "Fasteners",   "200", "1.50",   "500",  "A-01", "FastenCo"],
    ["CMP-PCB-01",  "Circuit Board v2",    "pcs", "Electronics", "20",  "450.00", "40",   "B-02", "PCB Works"],
    ["CMP-CASE-01", "Steel Casing",        "pcs", "Enclosure",   "15",  "320.00", "30",   "C-01", "MetalForm"],
    ["CMP-WIRE-2C", "2-Core Wire",         "m",   "Cabling",     "50",  "18.50",  "100",  "D-04", "ElectroSupply"],
    ["CMP-LED-RED", "LED Indicator Red",   "pcs", "Electronics", "40",  "12.00",  "30",   "B-05", "ElectroSupply"],
    ["CMP-BTN-22",  "Push Button 22mm",    "pcs", "Electronics", "30",  "35.00",  "60",   "B-06", "ElectroSupply"],
    ["CMP-RLY-12V", "Relay 12V 10A",       "pcs", "Electronics", "25",  "85.00",  "30",   "B-07", "ElectroSupply"],
    ["CMP-TRM-BLK", "Terminal Block",      "pcs", "Electronics", "100", "8.00",   "150",  "A-03", "ElectroSupply"],
    ["CMP-ALU-SHT", "Aluminium Sheet 2mm", "kg",  "Raw Material","25",  "240.00", "12.5", "E-01", "MetalForm"],
    ["CMP-GSK-RUB", "Rubber Gasket",       "pcs", "Consumables", "30",  "6.50",   "80",   "C-03", "SealTech"],
    ["CMP-PSU-24V", "Power Supply 24V 5A", "pcs", "Electronics", "10",  "950.00", "0",    "B-01", "ElectroSupply"],
    ["CMP-FUS-5A",  "Fuse 5A",             "pcs", "Electronics", "50",  "4.00",   "200",  "A-05", "ElectroSupply"],
    ["CMP-GLD-M20", "Cable Gland M20",     "pcs", "Consumables", "60",  "9.50",   "100",  "A-06", "SealTech"],
    ["CMP-LBL-STD", "Label Sticker",       "pcs", "Consumables", "500", "0.80",   "2000", "F-01", "FastenCo"],
    ["CMP-PNT-GRY", "Paint Powder Grey",   "kg",  "Raw Material","10",  "150.00", "4.2",  "E-02", "MetalForm"],
  ];

  const components = new Map<string, string>();
  for (const [sku, name, unit, category, minLevel, unitCost, receiveQty, location, supplier] of componentData) {
    const c = await db.component.create({
      data: {
        sku, name, unit, category,
        minLevel: toMilli(minLevel),
        unitCost: toMilli(unitCost),
        location, supplier,
      },
    });
    components.set(sku, c.id);
    if (parseFloat(receiveQty) > 0) {
      await receiveStock({
        componentId: c.id,
        warehouseId: main.id,
        qtyMilli: toMilli(receiveQty),
        note: "Opening stock",
        createdBy: "Sana Store",
      });
    }
  }

  console.log("Products + BOMs…");
  const productData: { sku: string; name: string; description: string; bom: [string, string][] }[] = [
    {
      sku: "PRD-CTRL-PNL", name: "Control Panel",
      description: "Wall-mount industrial control panel",
      bom: [["CMP-SCR-M4", "8"], ["CMP-PCB-01", "1"], ["CMP-CASE-01", "1"], ["CMP-WIRE-2C", "2.5"]],
    },
    {
      sku: "PRD-JNC-BOX", name: "Junction Box",
      description: "IP65 junction box, 12-way",
      bom: [["CMP-TRM-BLK", "6"], ["CMP-GLD-M20", "4"], ["CMP-SCR-M4", "4"], ["CMP-GSK-RUB", "1"]],
    },
    {
      sku: "PRD-MTR-STR", name: "Motor Starter Unit",
      description: "DOL starter with overload protection",
      bom: [["CMP-RLY-12V", "2"], ["CMP-BTN-22", "2"], ["CMP-FUS-5A", "2"], ["CMP-WIRE-2C", "1.2"], ["CMP-TRM-BLK", "4"]],
    },
    {
      sku: "PRD-IND-LMP", name: "Indicator Lamp Assembly",
      description: "Panel-mount status lamp cluster",
      bom: [["CMP-LED-RED", "3"], ["CMP-BTN-22", "1"], ["CMP-WIRE-2C", "0.4"], ["CMP-LBL-STD", "2"]],
    },
  ];

  const products = new Map<string, string>();
  for (const p of productData) {
    const created = await db.product.create({
      data: { sku: p.sku, name: p.name, description: p.description },
    });
    products.set(p.sku, created.id);
    for (const [csku, qty] of p.bom) {
      await db.bomItem.create({
        data: { productId: created.id, componentId: components.get(csku)!, qtyPerUnit: toMilli(qty) },
      });
    }
  }

  console.log("Production runs (through the real deduction engine)…");
  const run1 = await completeProductionRun({
    productId: products.get("PRD-CTRL-PNL")!,
    qtyMilli: toMilli("10"),
    warehouseId: main.id,
    note: "Demo batch — worked example from spec",
    createdBy: "Manoj Manager",
  });
  await completeProductionRun({
    productId: products.get("PRD-JNC-BOX")!,
    qtyMilli: toMilli("5"),
    warehouseId: main.id,
    note: "Customer order JB-114",
    createdBy: "Manoj Manager",
  });
  await completeProductionRun({
    productId: products.get("PRD-MTR-STR")!,
    qtyMilli: toMilli("8"),
    warehouseId: main.id,
    note: "Stock build",
    createdBy: "Omar Operator",
  });

  // Worked example assertion: CP x10 must consume 80 / 10 / 10 / 25.
  const expected: Record<string, string> = {
    "CMP-SCR-M4": "80", "CMP-PCB-01": "10", "CMP-CASE-01": "10", "CMP-WIRE-2C": "25",
  };
  const linesBySku = new Map(run1.lines.map((l) => [l.component.sku, l.qtyConsumed]));
  for (const [sku, exp] of Object.entries(expected)) {
    if (linesBySku.get(sku) !== toMilli(exp)) {
      throw new Error(`Worked example FAILED: ${sku} consumed ${linesBySku.get(sku)}, expected ${toMilli(exp)}`);
    }
  }
  console.log("✓ Worked example verified: Control Panel ×10 → 80 screws, 10 PCBs, 10 casings, 25 m wire");

  console.log("Warehouse transfer…");
  await transferStock({
    componentId: components.get("CMP-SCR-M4")!,
    fromWarehouseId: main.id,
    toWarehouseId: floor.id,
    qtyMilli: toMilli("100"),
    note: "Line-side replenishment",
    createdBy: "Sana Store",
  });

  console.log("Purchasing demo flow…");
  // 1. PSU requisition: raised by store, approved by admin (value above manager limit), partially received.
  const psuReq = await createRequisition({
    warehouseId: main.id,
    supplierId: suppliers.get("ElectroSupply"),
    note: "PSUs out of stock — blocking future beacon assembly",
    lines: [{ componentId: components.get("CMP-PSU-24V")!, qtyMilli: toMilli("60") }],
    actor: asSession(store),
    submit: true,
  });
  await decideRequisition({
    id: psuReq.id,
    approve: true,
    comment: "High value — approved at admin level",
    actor: asSession(admin),
  });
  await receiveGoods({
    id: psuReq.id,
    receipts: [{ lineId: psuReq.lines[0].id, qtyMilli: toMilli("20") }],
    actor: asSession(store),
  });

  // 2. Aluminium requisition: pending approval (shows up on dashboards).
  await createRequisition({
    warehouseId: main.id,
    supplierId: suppliers.get("MetalForm"),
    note: "Aluminium sheet below min level",
    lines: [
      { componentId: components.get("CMP-ALU-SHT")!, qtyMilli: toMilli("40") },
      { componentId: components.get("CMP-PNT-GRY")!, qtyMilli: toMilli("20") },
    ],
    actor: asSession(manager),
    submit: true,
  });

  // ---- Reconciliation: ledger vs totals vs per-warehouse levels ----
  for (const c of await db.component.findMany({ include: { stockLevels: true } })) {
    const sum = await db.stockMovement.aggregate({
      where: { componentId: c.id },
      _sum: { qtyChange: true },
    });
    if ((sum._sum.qtyChange ?? 0) !== c.stockQty) {
      throw new Error(`Ledger mismatch for ${c.sku}: movements ${sum._sum.qtyChange}, stockQty ${c.stockQty}`);
    }
    const levelSum = c.stockLevels.reduce((s, l) => s + l.qty, 0);
    if (levelSum !== c.stockQty) {
      throw new Error(`Warehouse mismatch for ${c.sku}: levels ${levelSum}, total ${c.stockQty}`);
    }
  }
  console.log("✓ Ledger + warehouse levels reconcile with totals for all components");

  const lows = (await db.component.findMany()).filter((c) => c.stockQty <= c.minLevel);
  console.log(`\nSeeded: 15 components, 4 products, 3 runs, 2 warehouses, 4 users, 5 suppliers, 2 requisitions`);
  for (const c of lows) {
    console.log(`  low/out: ${c.name} — ${fmtQty(c.stockQty)}/${fmtQty(c.minLevel)} ${c.unit}`);
  }
  console.log("\nDemo logins (password demo1234): admin@demo.local · manager@demo.local · store@demo.local · operator@demo.local");
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
