import * as React from "react";
import { cn } from "@/lib/utils";

const styles = {
  ok: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400",
  low: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
  out: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  neutral: "bg-slate-100 text-slate-600",
  info: "bg-primary-soft text-primary dark:text-indigo-300",
} as const;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof styles }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Stock status badge from milli quantities. */
export function StockBadge({ stock, minLevel }: { stock: number; minLevel: number }) {
  if (stock <= 0) return <Badge tone="out">Out</Badge>;
  if (stock < minLevel) return <Badge tone="low">Low</Badge>;
  return <Badge tone="ok">OK</Badge>;
}

/** Requisition / run status badge. */
const statusTones: Record<string, keyof typeof styles> = {
  COMPLETED: "ok",
  CANCELLED: "out",
  DRAFT: "neutral",
  PENDING_APPROVAL: "low",
  APPROVED: "ok",
  REJECTED: "out",
  ORDERED: "info",
  RECEIVED: "ok",
  CLOSED: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTones[status] ?? "neutral"}>{status.replaceAll("_", " ")}</Badge>;
}
