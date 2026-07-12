import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { getDashboardData, type RangeKey } from "@/lib/analytics";
import { getSettings } from "@/lib/settings";
import { fmtQty, fmtMoney } from "@/lib/qty";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import {
  Factory,
  Wallet,
  AlertTriangle,
  Flame,
  Gauge,
  RefreshCcw,
  ShoppingCart,
  Ban,
} from "lucide-react";
import { ProductionTrendChart, TopConsumedChart, StockHealthDonut } from "./dashboard-charts";

export const dynamic = "force-dynamic";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "mtd", label: "MTD" },
  { key: "qtd", label: "QTD" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const user = await requireUser();
  const range = (RANGES.some((r) => r.key === searchParams.range) ? searchParams.range : "30d") as RangeKey;
  const [data, settings, recentRuns, recentActivity] = await Promise.all([
    getDashboardData(range),
    getSettings(),
    db.productionRun.findMany({ include: { product: true }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const k = data.kpis;
  const cur = settings.currency;
  const isOperator = user.role === "OPERATOR";

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${user.name.split(" ")[0]} — production and stock at a glance`}
        actions={
          <div className="flex rounded-md border border-slate-200 bg-surface p-0.5">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/?range=${r.key}`}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  range === r.key ? "bg-primary text-white" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Production output"
          value={`${fmtQty(k.output)} units`}
          icon={Factory}
          deltaPct={k.outputDelta}
          sub="vs previous period"
        />
        <StatCard
          label="Inventory value"
          value={`${cur} ${fmtMoney(k.inventoryValue)}`}
          icon={Wallet}
          sub={`components ${fmtMoney(k.componentValue)} · finished ${fmtMoney(k.finishedValue)}`}
        />
        <StatCard
          label="Low / out of stock"
          value={`${k.lowCount + k.outCount}`}
          icon={AlertTriangle}
          sub={`${k.lowCount} low · ${k.outCount} out`}
          alert={k.lowCount + k.outCount > 0}
          href="/reports"
        />
        <StatCard
          label="Material consumption"
          value={`${cur} ${fmtMoney(k.consumptionValue)}`}
          icon={Flame}
          deltaPct={k.consumptionDelta}
          deltaGoodWhen="down"
          sub="cost of components consumed"
        />
        <StatCard
          label="Buildable coverage"
          value={`${Math.round(k.buildableCoverage)}%`}
          icon={Gauge}
          sub={`${k.buildableCount}/${k.productsWithBom} products buildable ≥ 1`}
          alert={k.buildableCoverage < 50}
        />
        <StatCard
          label="Inventory turnover (est.)"
          value={`${k.turnover.toFixed(1)}×`}
          icon={RefreshCcw}
          sub="annualized, consumption ÷ inventory"
        />
        {!isOperator && (
          <StatCard
            label="Pending requisitions"
            value={String(k.pendingPrCount)}
            icon={ShoppingCart}
            sub={`${cur} ${fmtMoney(k.pendingPrValue)} awaiting approval`}
            href="/purchasing"
            alert={k.pendingPrCount > 0}
          />
        )}
        <StatCard
          label="Stockout incidents"
          value={String(k.stockoutIncidents)}
          icon={Ban}
          deltaPct={k.stockoutDelta}
          deltaGoodWhen="down"
          sub="runs blocked by shortfall"
          alert={k.stockoutIncidents > 0}
        />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Production trend</CardTitle>
            <CardDescription>Units produced per day, by product</CardDescription>
          </CardHeader>
          <CardContent>
            <ProductionTrendChart data={data.trend} products={data.trendProducts} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top consumed components</CardTitle>
            <CardDescription>By consumption value in the period</CardDescription>
          </CardHeader>
          <CardContent>
            <TopConsumedChart
              data={data.topConsumed.map((t) => ({
                name: t.name,
                value: Math.round(t.value / 1000),
                qtyLabel: `${fmtQty(t.qty)} ${t.unit}`,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Stock health</CardTitle>
            <CardDescription>Active components by status</CardDescription>
          </CardHeader>
          <CardContent>
            <StockHealthDonut ok={data.stockHealth.ok} low={data.stockHealth.low} out={data.stockHealth.out} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Critical shortages</CardTitle>
            <CardDescription>Components blocking production</CardDescription>
          </CardHeader>
          <CardContent>
            {data.criticalShortages.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Nothing is blocking production. 🎉</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {data.criticalShortages.map((s) => (
                  <li key={s.componentId} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{s.name}</div>
                      <div className="truncate text-xs text-slate-400">
                        blocks {s.productsBlocked.join(", ")}
                      </div>
                    </div>
                    <Badge tone="out">{s.productsBlocked.length} blocked</Badge>
                    {!isOperator && (
                      <Link
                        href={`/purchasing/new?componentId=${s.componentId}`}
                        className="shrink-0 text-xs font-medium text-primary hover:underline dark:text-indigo-300"
                      >
                        Raise req.
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Runs, receipts, approvals</CardDescription>
            </div>
            <Link href="/production" className="text-sm font-medium text-primary hover:underline dark:text-indigo-300">
              Runs →
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {recentRuns.slice(0, 3).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <Link href={`/production/${r.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                    {r.runNo} · {r.product.name}
                  </Link>
                  <span className="tabular-nums text-slate-500">{fmtQty(r.qtyToProduce)}</span>
                  <StatusBadge status={r.status} />
                </li>
              ))}
              {recentActivity.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{a.actorName ?? "system"}</span>
                  <span className="truncate">{a.action}</span>
                  <span className="ml-auto shrink-0">
                    {a.createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
