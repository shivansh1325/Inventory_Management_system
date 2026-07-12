"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { getAnalyticsData } from "@/lib/analytics";
import { fmtQty, fmtMoney, mulQty, toMilli, divFloor } from "@/lib/qty";
import { TabBar } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Label } from "@/components/ui/input";

type Data = Awaited<ReturnType<typeof getAnalyticsData>>;

const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
const axisProps = {
  tick: { fill: "rgb(var(--chart-tick))", fontSize: 11 },
  axisLine: false as const,
  tickLine: false as const,
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-surface px-3 py-2 text-xs shadow-md">
      {label && <div className="mb-1 font-semibold text-slate-900">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          {p.name}: <b className="tabular-nums">{Number(p.value).toLocaleString()}</b>
        </div>
      ))}
    </div>
  );
}

const TABS = [
  { key: "production", label: "Production" },
  { key: "inventory", label: "Inventory" },
  { key: "consumption", label: "Consumption & Cost" },
  { key: "purchasing", label: "Purchasing" },
];

export function AnalyticsClient({ data, currency }: { data: Data; currency: string }) {
  const [tab, setTab] = useState("production");
  return (
    <div className="space-y-5">
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === "production" && <ProductionTab data={data.production} />}
      {tab === "inventory" && <InventoryTab data={data.inventory} currency={currency} />}
      {tab === "consumption" && <ConsumptionTab data={data.consumption} currency={currency} />}
      {tab === "purchasing" && <PurchasingTab data={data.purchasing} currency={currency} />}
    </div>
  );
}

function ProductionTab({ data }: { data: Data["production"] }) {
  const successPct =
    data.runStats.completed + data.runStats.blocked90 > 0
      ? Math.round(
          (data.runStats.completed / (data.runStats.completed + data.runStats.blocked90)) * 100,
        )
      : null;
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Output — last 60 days</CardTitle>
          <CardDescription>Units per day, stacked by product</CardDescription>
        </CardHeader>
        <CardContent>
          {data.outputTrend.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No completed runs yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.outputTrend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgb(var(--chart-grid))" />
                <XAxis dataKey="day" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgb(var(--slate-100))" }} />
                {data.productNames.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
                {data.productNames.map((p, i) => (
                  <Bar key={p} dataKey={p} stackId="o" fill={SERIES[i % SERIES.length]} maxBarSize={26} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Run success vs blocked</CardTitle>
          <CardDescription>Completed runs vs shortfall blocks (90d)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-4xl font-bold tabular-nums">
            {successPct == null ? "—" : `${successPct}%`}
          </div>
          <p className="text-sm text-slate-500">
            {data.runStats.completed} completed · {data.runStats.blocked90} blocked attempts
          </p>
          {data.runStats.blocked90 > 0 && (
            <p className="text-xs text-slate-400">
              Every block is logged as a stockout incident — see the audit log for the exact
              components that were short.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Material cost per unit</CardTitle>
          <CardDescription>Current BOM cost — watch for cost creep after BOM edits</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Product</TH>
                <TH className="text-right">BOM cost / unit</TH>
                <TH>Breakdown</TH>
              </TR>
            </THead>
            <TBody>
              {data.costPerUnit.map((p) => (
                <TR key={p.name}>
                  <TD className="font-medium">{p.name}</TD>
                  <TD className="text-right font-semibold tabular-nums">{fmtMoney(p.bomCost)}</TD>
                  <TD className="text-xs text-slate-500">
                    {p.lines
                      .map((l) => `${l.component} ${fmtQty(l.qtyPerUnit)}${l.unit === "pcs" ? "" : l.unit}${l.cost != null ? ` (${fmtMoney(l.cost)})` : ""}`)
                      .join(" · ")}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function InventoryTab({ data, currency }: { data: Data["inventory"]; currency: string }) {
  const abcTop = data.abc.filter((a) => a.value > 0).slice(0, 12);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Inventory value over time</CardTitle>
          <CardDescription>Computed from the movement ledger at current unit costs ({currency})</CardDescription>
        </CardHeader>
        <CardContent>
          {data.valueTrend.length < 2 ? (
            <p className="py-12 text-center text-sm text-slate-400">Not enough ledger history yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.valueTrend} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgb(var(--chart-grid))" />
                <XAxis dataKey="day" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="value" name="Value" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.12} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ABC analysis (90d consumption value)</CardTitle>
          <CardDescription>Pareto — A ≈ top 80% of value, B to 95%, C the tail</CardDescription>
        </CardHeader>
        <CardContent>
          {abcTop.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No consumption in the last 90 days.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, abcTop.length * 30)}>
              <ComposedChart data={abcTop.map((a) => ({ name: a.name, value: Math.round(a.value / 1000), cum: Math.round(a.cumPct) }))} layout="vertical" margin={{ left: 8, right: 30 }}>
                <CartesianGrid horizontal={false} stroke="rgb(var(--chart-grid))" />
                <XAxis type="number" {...axisProps} />
                <YAxis type="category" dataKey="name" width={125} {...axisProps} tick={{ ...axisProps.tick, fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgb(var(--slate-100))" }} />
                <Bar dataKey="value" name="Value" fill="var(--chart-1)" barSize={12} radius={[0, 4, 4, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.abc.slice(0, 12).map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-500">
                <Badge tone={a.class === "A" ? "out" : a.class === "B" ? "low" : "neutral"} className="px-1.5 py-0">{a.class}</Badge>
                {a.name}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Days of stock remaining</CardTitle>
          <CardDescription>Stock ÷ average daily consumption (30d) — under 7 days is critical</CardDescription>
        </CardHeader>
        <CardContent>
          {data.daysOfStock.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No consumption in the last 30 days.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Component</TH>
                  <TH className="text-right">Stock</TH>
                  <TH className="text-right">Daily use</TH>
                  <TH className="text-right">Days left</TH>
                </TR>
              </THead>
              <TBody>
                {data.daysOfStock.slice(0, 10).map((d) => (
                  <TR key={d.id}>
                    <TD className="font-medium">{d.name}</TD>
                    <TD className="text-right tabular-nums text-slate-500">{fmtQty(d.stockQty)} {d.unit}</TD>
                    <TD className="text-right tabular-nums text-slate-500">{fmtQty(Math.round(d.dailyMilli))} {d.unit}</TD>
                    <TD className="text-right">
                      {d.days == null ? "—" : (
                        <Badge tone={d.days < 7 ? "out" : d.days < 21 ? "low" : "ok"}>
                          {Math.floor(d.days)} d
                        </Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Slow-moving / dead stock</CardTitle>
          <CardDescription>Stocked components with no consumption in 60+ days</CardDescription>
        </CardHeader>
        <CardContent>
          {data.slowMoving.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No dead stock — everything moves.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {data.slowMoving.slice(0, 10).map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="tabular-nums text-slate-500">{fmtQty(c.stockQty)} {c.unit}</span>
                  <Badge tone={c.lastDays == null ? "out" : c.lastDays >= 90 ? "out" : "low"}>
                    {c.lastDays == null ? "never used" : `${c.lastDays}d idle`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock accuracy</CardTitle>
          <CardDescription>Manual adjustments in the last 30 days — a high rate signals process problems</CardDescription>
        </CardHeader>
        <CardContent className="flex items-baseline gap-6">
          <div>
            <div className="text-3xl font-bold tabular-nums">{data.adjustmentStats.count}</div>
            <div className="text-xs text-slate-400">adjustments</div>
          </div>
          <div>
            <div className="text-3xl font-bold tabular-nums">{currency} {fmtMoney(data.adjustmentStats.absValue)}</div>
            <div className="text-xs text-slate-400">absolute value corrected</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConsumptionTab({ data, currency }: { data: Data["consumption"]; currency: string }) {
  const [productId, setProductId] = useState(data.whatIfProducts[0]?.id ?? "");
  const [qty, setQty] = useState("10");
  const product = data.whatIfProducts.find((p) => p.id === productId);
  const qtyValid = /^\d+(\.\d{1,3})?$/.test(qty.trim()) && parseFloat(qty) > 0;

  const whatIf = useMemo(() => {
    if (!product || !qtyValid) return null;
    const q = toMilli(qty.trim());
    return product.bom.map((b) => {
      const required = mulQty(b.qtyPerUnit, q);
      const after = b.stockQty - required;
      return {
        ...b,
        required,
        after,
        short: after < 0,
        daysAfter: b.dailyMilli > 0 && after > 0 ? Math.floor(after / b.dailyMilli) : null,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, qty, qtyValid]);

  const maxBuildable = product
    ? Math.min(...product.bom.map((b) => divFloor(b.stockQty, b.qtyPerUnit)))
    : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Consumption by category (90d)</CardTitle>
          <CardDescription>Value of components consumed, by category ({currency})</CardDescription>
        </CardHeader>
        <CardContent>
          {data.categoryConsumption.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No consumption yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, data.categoryConsumption.length * 36)}>
              <BarChart data={data.categoryConsumption} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke="rgb(var(--chart-grid))" />
                <XAxis type="number" {...axisProps} />
                <YAxis type="category" dataKey="category" width={110} {...axisProps} tick={{ ...axisProps.tick, fontSize: 12 }} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgb(var(--slate-100))" }} />
                <Bar dataKey="value" name="Value" fill="var(--chart-2)" barSize={14} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What-if: material runway</CardTitle>
          <CardDescription>
            “If I produce X units, which components run out — and how many days of normal
            consumption remain afterwards?”
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-52 flex-1 space-y-1">
              <Label>Product</Label>
              <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
                {data.whatIfProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div className="w-32 space-y-1">
              <Label>Units</Label>
              <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
            </div>
            {product && (
              <div className="pb-2 text-xs text-slate-500">max buildable now: <b>{maxBuildable}</b></div>
            )}
          </div>
          {whatIf && (
            <Table>
              <THead>
                <TR>
                  <TH>Component</TH>
                  <TH className="text-right">Required</TH>
                  <TH className="text-right">Stock after</TH>
                  <TH className="text-right">Runway after</TH>
                </TR>
              </THead>
              <TBody>
                {whatIf.map((w) => (
                  <TR key={w.componentId} className={w.short ? "bg-danger/5" : ""}>
                    <TD className="font-medium">{w.name}</TD>
                    <TD className="text-right tabular-nums">{fmtQty(w.required)} {w.unit}</TD>
                    <TD className={`text-right tabular-nums ${w.short ? "font-semibold text-danger" : "text-slate-500"}`}>
                      {fmtQty(w.after)} {w.unit}
                    </TD>
                    <TD className="text-right">
                      {w.short ? (
                        <Badge tone="out">runs out</Badge>
                      ) : w.daysAfter == null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <Badge tone={w.daysAfter < 7 ? "low" : "ok"}>{w.daysAfter} d</Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PurchasingTab({ data, currency }: { data: Data["purchasing"]; currency: string }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Spend by supplier</CardTitle>
          <CardDescription>Value of goods received against requisitions, last 90 days ({currency})</CardDescription>
        </CardHeader>
        <CardContent>
          {data.spend.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No goods received yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, data.spend.length * 40)}>
              <BarChart data={data.spend} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke="rgb(var(--chart-grid))" />
                <XAxis type="number" {...axisProps} />
                <YAxis type="category" dataKey="supplier" width={130} {...axisProps} tick={{ ...axisProps.tick, fontSize: 12 }} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgb(var(--slate-100))" }} />
                <Bar dataKey="value" name="Spend" fill="var(--chart-3)" barSize={16} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader><CardTitle>Requisition cycle time</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {data.avgCycleDays == null ? "—" : `${data.avgCycleDays.toFixed(1)} d`}
            </div>
            <p className="text-xs text-slate-400">average raised → decided ({data.totalPrs} requisitions)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Supplier fill rate</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">
              {data.fillRate == null ? "—" : `${Math.round(data.fillRate)}%`}
            </div>
            <p className="text-xs text-slate-400">quantity received ÷ requested, ordered requisitions</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
