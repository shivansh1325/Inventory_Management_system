import { db } from "@/lib/db";
import { mulQty } from "@/lib/qty";
import { buildableUnitsTotal } from "@/lib/services/production";

/**
 * Analytics computed straight from the immutable movement ledger.
 * At this dataset scale on-demand aggregation is fast; if the ledger grows
 * into the millions, materialize a DailyStockSnapshot table and swap the
 * value-trend/consumption queries to read from it.
 */

export type RangeKey = "today" | "7d" | "30d" | "mtd" | "qtd";

export function resolveRange(key: RangeKey, now = new Date()) {
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  let start: Date;
  switch (key) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "7d":
      start = new Date(endOfToday.getTime() - 7 * 86400_000);
      break;
    case "30d":
      start = new Date(endOfToday.getTime() - 30 * 86400_000);
      break;
    case "mtd":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "qtd": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), q, 1);
      break;
    }
  }
  const spanMs = endOfToday.getTime() - start.getTime();
  return {
    start,
    end: endOfToday,
    prevStart: new Date(start.getTime() - spanMs),
    prevEnd: start,
  };
}

export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export async function getDashboardData(rangeKey: RangeKey) {
  const range = resolveRange(rangeKey);
  const [components, products, prs, blockedCount, prevBlockedCount] = await Promise.all([
    db.component.findMany({ where: { isActive: true } }),
    db.product.findMany({ where: { isActive: true }, include: { bomItems: { include: { component: true } } } }),
    db.purchaseRequisition.findMany({
      where: { status: "PENDING_APPROVAL" },
      include: { lines: true },
    }),
    db.auditLog.count({ where: { action: "run.blocked", createdAt: { gte: range.start, lt: range.end } } }),
    db.auditLog.count({ where: { action: "run.blocked", createdAt: { gte: range.prevStart, lt: range.prevEnd } } }),
  ]);

  const costById = new Map(components.map((c) => [c.id, c.unitCost]));

  const movementsIn = await db.stockMovement.findMany({
    where: { createdAt: { gte: range.prevStart, lt: range.end } },
    include: { product: true, component: true },
    orderBy: { createdAt: "asc" },
  });
  const inPeriod = (m: { createdAt: Date }) => m.createdAt >= range.start;
  const cur = movementsIn.filter(inPeriod);
  const prev = movementsIn.filter((m) => !inPeriod(m));

  const outputOf = (ms: typeof movementsIn) =>
    ms.filter((m) => m.type === "PRODUCTION_OUTPUT").reduce((s, m) => s + m.qtyChange, 0);
  const consumptionValueOf = (ms: typeof movementsIn) =>
    ms
      .filter((m) => m.type === "PRODUCTION_CONSUMPTION" && m.componentId)
      .reduce((s, m) => {
        const cost = costById.get(m.componentId!) ?? m.component?.unitCost ?? null;
        return s + (cost != null ? mulQty(-m.qtyChange, cost) : 0);
      }, 0);

  const output = outputOf(cur);
  const prevOutput = outputOf(prev);
  const consumptionValue = consumptionValueOf(cur);
  const prevConsumptionValue = consumptionValueOf(prev);

  // Inventory value now: components at cost + finished goods at BOM material cost.
  const bomCostOf = (p: (typeof products)[number]) =>
    p.bomItems.reduce(
      (s, b) => s + (b.component.unitCost != null ? mulQty(b.qtyPerUnit, b.component.unitCost) : 0),
      0,
    );
  const componentValue = components.reduce(
    (s, c) => s + (c.unitCost != null ? mulQty(c.stockQty, c.unitCost) : 0),
    0,
  );
  const finishedValue = products.reduce((s, p) => s + mulQty(p.finishedStockQty, bomCostOf(p)), 0);

  const low = components.filter((c) => c.stockQty < c.minLevel && c.stockQty > 0);
  const out = components.filter((c) => c.stockQty <= 0);

  const withBom = products.filter((p) => p.bomItems.length > 0);
  const buildableCount = withBom.filter((p) => buildableUnitsTotal(p.bomItems) >= 1).length;
  const buildableCoverage = withBom.length ? (buildableCount / withBom.length) * 100 : 0;

  // Turnover (annualized estimate): consumption in period scaled to a year / current inventory value.
  const spanDays = Math.max(1, (range.end.getTime() - range.start.getTime()) / 86400_000);
  const inventoryValue = componentValue + finishedValue;
  const turnover =
    inventoryValue > 0 ? (consumptionValue * (365 / spanDays)) / inventoryValue : 0;

  const pendingPrValue = prs.reduce(
    (s, pr) =>
      s +
      pr.lines.reduce(
        (x, l) => x + (l.estUnitCost != null ? mulQty(l.qtyRequested, l.estUnitCost) : 0),
        0,
      ),
    0,
  );

  // Production trend by day, stacked per product (period only).
  const trendMap = new Map<string, Record<string, number>>();
  const productNames = new Set<string>();
  for (const m of cur) {
    if (m.type !== "PRODUCTION_OUTPUT" || !m.product) continue;
    const k = dayKey(m.createdAt);
    productNames.add(m.product.name);
    const row = trendMap.get(k) ?? {};
    row[m.product.name] = (row[m.product.name] ?? 0) + m.qtyChange / 1000;
    trendMap.set(k, row);
  }
  const trend = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, values]) => ({ day: day.slice(5), ...values }));

  // Top consumed components (qty + value) in period.
  const consumedBy = new Map<string, { name: string; unit: string; qty: number; value: number }>();
  for (const m of cur) {
    if (m.type !== "PRODUCTION_CONSUMPTION" || !m.component) continue;
    const e = consumedBy.get(m.component.id) ?? {
      name: m.component.name,
      unit: m.component.unit,
      qty: 0,
      value: 0,
    };
    e.qty += -m.qtyChange;
    e.value += m.component.unitCost != null ? mulQty(-m.qtyChange, m.component.unitCost) : 0;
    consumedBy.set(m.component.id, e);
  }
  const topConsumed = [...consumedBy.values()].sort((a, b) => b.value - a.value).slice(0, 8);

  // Critical shortages: components short for >= 1 unit of some product.
  const shortages = new Map<
    string,
    { name: string; sku: string; unit: string; productsBlocked: string[]; shortfallValue: number }
  >();
  for (const p of withBom) {
    const buildable = buildableUnitsTotal(p.bomItems);
    if (buildable >= 1) continue;
    for (const b of p.bomItems) {
      if (b.component.stockQty >= b.qtyPerUnit) continue;
      const e = shortages.get(b.componentId) ?? {
        name: b.component.name,
        sku: b.component.sku,
        unit: b.component.unit,
        productsBlocked: [],
        shortfallValue: 0,
      };
      e.productsBlocked.push(p.name);
      const shortQty = b.qtyPerUnit - b.component.stockQty;
      e.shortfallValue += b.component.unitCost != null ? mulQty(shortQty, b.component.unitCost) : 0;
      shortages.set(b.componentId, e);
    }
  }
  const criticalShortages = [...shortages.entries()]
    .map(([componentId, s]) => ({ componentId, ...s }))
    .sort((a, b) => b.productsBlocked.length - a.productsBlocked.length || b.shortfallValue - a.shortfallValue)
    .slice(0, 6);

  return {
    range: rangeKey,
    kpis: {
      output,
      outputDelta: pctDelta(output, prevOutput),
      inventoryValue,
      componentValue,
      finishedValue,
      lowCount: low.length,
      outCount: out.length,
      consumptionValue,
      consumptionDelta: pctDelta(consumptionValue, prevConsumptionValue),
      buildableCoverage,
      buildableCount,
      productsWithBom: withBom.length,
      turnover,
      pendingPrCount: prs.length,
      pendingPrValue,
      stockoutIncidents: blockedCount,
      stockoutDelta: pctDelta(blockedCount, prevBlockedCount),
    },
    trend,
    trendProducts: [...productNames],
    topConsumed,
    stockHealth: {
      ok: components.length - low.length - out.length,
      low: low.length,
      out: out.length,
    },
    criticalShortages,
  };
}

// ---------------- Analytics page ----------------

export async function getAnalyticsData() {
  const now = new Date();
  const d90 = new Date(now.getTime() - 90 * 86400_000);
  const d60 = new Date(now.getTime() - 60 * 86400_000);
  const d30 = new Date(now.getTime() - 30 * 86400_000);

  const [components, products, movements, runs, blockedLogs, receipts, prs] = await Promise.all([
    db.component.findMany({ where: { isActive: true } }),
    db.product.findMany({
      where: { isActive: true },
      include: { bomItems: { include: { component: true } } },
    }),
    db.stockMovement.findMany({
      where: { componentId: { not: null } },
      include: { component: true },
      orderBy: { createdAt: "asc" },
    }),
    db.productionRun.findMany({
      where: { status: "COMPLETED" },
      include: { product: true, lines: { include: { component: true } } },
      orderBy: { producedAt: "asc" },
    }),
    db.auditLog.count({ where: { action: "run.blocked", createdAt: { gte: d90 } } }),
    db.stockMovement.findMany({
      where: { type: "RECEIPT", refType: "PurchaseRequisition", createdAt: { gte: d90 } },
      include: { component: true },
    }),
    db.purchaseRequisition.findMany({ include: { lines: true, supplier: true } }),
  ]);

  // --- Inventory value trend (daily, whole ledger, cost = current unitCost) ---
  const valueTrendMap = new Map<string, number>();
  let running = 0;
  for (const m of movements) {
    const cost = m.component?.unitCost;
    if (cost != null) running += mulQty(m.qtyChange, cost);
    valueTrendMap.set(dayKey(m.createdAt), running);
  }
  const valueTrend = [...valueTrendMap.entries()].map(([day, value]) => ({
    day: day.slice(5),
    value: Math.round(value / 1000),
  }));

  // --- ABC by 90d consumption value ---
  const consumption90 = new Map<string, { name: string; value: number; qty: number; lastAt: Date | null }>();
  for (const c of components) consumption90.set(c.id, { name: c.name, value: 0, qty: 0, lastAt: null });
  let lastConsumption = new Map<string, Date>();
  for (const m of movements) {
    if (m.type !== "PRODUCTION_CONSUMPTION" || !m.componentId) continue;
    lastConsumption.set(m.componentId, m.createdAt);
    if (m.createdAt < d90) continue;
    const e = consumption90.get(m.componentId);
    if (!e) continue;
    e.qty += -m.qtyChange;
    e.value += m.component?.unitCost != null ? mulQty(-m.qtyChange, m.component.unitCost) : 0;
    e.lastAt = m.createdAt;
  }
  const abcSorted = [...consumption90.entries()]
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => b.value - a.value);
  const totalConsValue = abcSorted.reduce((s, e) => s + e.value, 0) || 1;
  let cum = 0;
  const abc = abcSorted.map((e) => {
    cum += e.value;
    const cumPct = (cum / totalConsValue) * 100;
    return { ...e, cumPct, class: cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C" };
  });

  // --- Days of stock (avg daily consumption over 30d) ---
  const cons30 = new Map<string, number>();
  for (const m of movements) {
    if (m.type !== "PRODUCTION_CONSUMPTION" || !m.componentId || m.createdAt < d30) continue;
    cons30.set(m.componentId, (cons30.get(m.componentId) ?? 0) + -m.qtyChange);
  }
  const daysOfStock = components
    .map((c) => {
      const daily = (cons30.get(c.id) ?? 0) / 30;
      return {
        id: c.id,
        name: c.name,
        unit: c.unit,
        stockQty: c.stockQty,
        dailyMilli: daily,
        days: daily > 0 ? c.stockQty / daily : null,
      };
    })
    .filter((d) => d.dailyMilli > 0)
    .sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity));

  // --- Slow-moving / dead stock ---
  const slowMoving = components
    .map((c) => {
      const last = lastConsumption.get(c.id) ?? null;
      const days = last ? Math.floor((now.getTime() - last.getTime()) / 86400_000) : null;
      return { id: c.id, name: c.name, stockQty: c.stockQty, unit: c.unit, lastDays: days };
    })
    .filter((c) => c.stockQty > 0 && (c.lastDays == null || c.lastDays >= 60))
    .sort((a, b) => (b.lastDays ?? 9999) - (a.lastDays ?? 9999));

  // --- Adjustment rate (30d) ---
  const adj30 = movements.filter((m) => m.type === "ADJUSTMENT" && m.createdAt >= d30);
  const adjustmentStats = {
    count: adj30.length,
    absValue: adj30.reduce(
      (s, m) =>
        s + (m.component?.unitCost != null ? mulQty(Math.abs(m.qtyChange), m.component.unitCost) : 0),
      0,
    ),
  };

  // --- Production tab ---
  const outputByDayProduct = new Map<string, Record<string, number>>();
  const productNames = new Set<string>();
  for (const r of runs) {
    if (!r.producedAt || r.producedAt < d60) continue;
    const k = dayKey(r.producedAt);
    productNames.add(r.product.name);
    const row = outputByDayProduct.get(k) ?? {};
    row[r.product.name] = (row[r.product.name] ?? 0) + r.qtyToProduce / 1000;
    outputByDayProduct.set(k, row);
  }
  const outputTrend = [...outputByDayProduct.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, values]) => ({ day: day.slice(5), ...values }));

  const runStats = { completed: runs.length, blocked90: blockedLogs };

  const costPerUnit = products
    .filter((p) => p.bomItems.length > 0)
    .map((p) => ({
      name: p.name,
      bomCost: p.bomItems.reduce(
        (s, b) => s + (b.component.unitCost != null ? mulQty(b.qtyPerUnit, b.component.unitCost) : 0),
        0,
      ),
      lines: p.bomItems.map((b) => ({
        component: b.component.name,
        qtyPerUnit: b.qtyPerUnit,
        unit: b.component.unit,
        cost: b.component.unitCost != null ? mulQty(b.qtyPerUnit, b.component.unitCost) : null,
      })),
    }))
    .sort((a, b) => b.bomCost - a.bomCost);

  // --- Consumption by category (90d) ---
  const byCategory = new Map<string, number>();
  for (const m of movements) {
    if (m.type !== "PRODUCTION_CONSUMPTION" || m.createdAt < d90 || !m.component) continue;
    const cat = m.component.category ?? "Uncategorised";
    byCategory.set(
      cat,
      (byCategory.get(cat) ?? 0) +
        (m.component.unitCost != null ? mulQty(-m.qtyChange, m.component.unitCost) : 0),
    );
  }
  const categoryConsumption = [...byCategory.entries()]
    .map(([category, value]) => ({ category, value: Math.round(value / 1000) }))
    .sort((a, b) => b.value - a.value);

  // --- Purchasing tab ---
  const spendBySupplier = new Map<string, number>();
  const prById = new Map(prs.map((p) => [p.id, p]));
  for (const r of receipts) {
    const pr = r.refId ? prById.get(r.refId) : null;
    const supplier = pr?.supplier?.name ?? "No supplier";
    spendBySupplier.set(
      supplier,
      (spendBySupplier.get(supplier) ?? 0) +
        (r.component?.unitCost != null ? mulQty(r.qtyChange, r.component.unitCost) : 0),
    );
  }
  const decidedPrs = prs.filter((p) => p.decidedAt);
  const avgCycleDays = decidedPrs.length
    ? decidedPrs.reduce((s, p) => s + (p.decidedAt!.getTime() - p.createdAt.getTime()), 0) /
      decidedPrs.length /
      86400_000
    : null;
  const receivable = prs.filter((p) => ["ORDERED", "RECEIVED", "CLOSED"].includes(p.status));
  const fillNum = receivable.reduce(
    (s, p) => s + p.lines.reduce((x, l) => x + Math.min(l.qtyReceived, l.qtyRequested), 0),
    0,
  );
  const fillDen = receivable.reduce((s, p) => s + p.lines.reduce((x, l) => x + l.qtyRequested, 0), 0);

  return {
    production: { outputTrend, productNames: [...productNames], runStats, costPerUnit },
    inventory: { valueTrend, abc, daysOfStock, slowMoving, adjustmentStats },
    consumption: {
      categoryConsumption,
      whatIfProducts: products
        .filter((p) => p.bomItems.length > 0)
        .map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          bom: p.bomItems.map((b) => ({
            componentId: b.componentId,
            name: b.component.name,
            unit: b.component.unit,
            qtyPerUnit: b.qtyPerUnit,
            stockQty: b.component.stockQty,
            dailyMilli: (cons30.get(b.componentId) ?? 0) / 30,
          })),
        })),
    },
    purchasing: {
      spend: [...spendBySupplier.entries()]
        .map(([supplier, value]) => ({ supplier, value: Math.round(value / 1000) }))
        .sort((a, b) => b.value - a.value),
      avgCycleDays,
      fillRate: fillDen > 0 ? (fillNum / fillDen) * 100 : null,
      totalPrs: prs.length,
    },
  };
}
