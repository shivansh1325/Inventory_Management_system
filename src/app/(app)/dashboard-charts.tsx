"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-surface px-3 py-2 text-xs shadow-md">
      {label && <div className="mb-1 font-semibold text-slate-900">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
          {p.name}: <b className="tabular-nums">{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</b>
        </div>
      ))}
    </div>
  );
}

const axisProps = {
  tick: { fill: "rgb(var(--chart-tick))", fontSize: 11 },
  axisLine: false as const,
  tickLine: false as const,
};

/** Stacked daily production output per product. */
export function ProductionTrendChart({
  data,
  products,
}: {
  data: Record<string, string | number>[];
  products: string[];
}) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-400">No production in this period.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgb(var(--chart-grid))" />
        <XAxis dataKey="day" {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgb(var(--slate-100))" }} />
        {products.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {products.map((p, i) => (
          <Bar
            key={p}
            dataKey={p}
            stackId="out"
            fill={SERIES[i % SERIES.length]}
            radius={i === products.length - 1 ? [4, 4, 0, 0] : 0}
            maxBarSize={28}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal top-consumed components by value. */
export function TopConsumedChart({
  data,
}: {
  data: { name: string; value: number; qtyLabel: string }[];
}) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-400">No consumption in this period.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="rgb(var(--chart-grid))" />
        <XAxis type="number" {...axisProps} />
        <YAxis type="category" dataKey="name" width={130} {...axisProps} tick={{ ...axisProps.tick, fontSize: 12 }} />
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="rounded-md border border-slate-200 bg-surface px-3 py-2 text-xs shadow-md">
                <div className="font-semibold text-slate-900">{payload[0].payload.name}</div>
                <div className="text-slate-600">Value: <b className="tabular-nums">{payload[0].payload.value.toLocaleString()}</b></div>
                <div className="text-slate-600">Qty: {payload[0].payload.qtyLabel}</div>
              </div>
            ) : null
          }
          cursor={{ fill: "rgb(var(--slate-100))" }}
        />
        <Bar dataKey="value" fill="var(--chart-1)" barSize={14} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Stock health donut — status colors with the counts labeled directly. */
export function StockHealthDonut({ ok, low, out }: { ok: number; low: number; out: number }) {
  const data = [
    { name: "OK", value: ok, fill: "#16A34A" },
    { name: "Low", value: low, fill: "#D97706" },
    { name: "Out", value: out, fill: "#DC2626" },
  ].filter((d) => d.value > 0);
  if (data.length === 0) return <p className="py-12 text-center text-sm text-slate-400">No components.</p>;
  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width={150} height={150}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={44} outerRadius={66} paddingAngle={3} strokeWidth={0}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.fill }} />
            <span className="text-slate-600">{d.name}</span>
            <b className="tabular-nums">{d.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
