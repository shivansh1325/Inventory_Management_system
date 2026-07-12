import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/**
 * KPI card with optional delta vs previous period.
 * deltaGoodWhen: whether an increase is good (green) or bad (red).
 */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  deltaPct,
  deltaGoodWhen = "up",
  href,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  deltaPct?: number | null;
  deltaGoodWhen?: "up" | "down";
  href?: string;
  alert?: boolean;
}) {
  const delta =
    deltaPct == null || !isFinite(deltaPct) ? null : Math.round(deltaPct);
  const good = delta != null && (deltaGoodWhen === "up" ? delta >= 0 : delta <= 0);
  const body = (
    <Card className={cn("h-full transition-shadow hover:shadow-md", alert && "border-warning/60")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-slate-500">{label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums leading-tight text-slate-900">{value}</div>
          </div>
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              alert ? "bg-warning/15 text-warning" : "bg-primary-soft text-primary dark:text-slate-800",
            )}
          >
            <Icon className="h-4.5 w-4.5 h-5 w-5" />
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          {delta != null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-semibold tabular-nums",
                good ? "text-success" : "text-danger",
              )}
            >
              {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta)}%
            </span>
          )}
          {sub && <span className="truncate text-slate-400">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  );
  return href ? <a href={href} className="block">{body}</a> : body;
}
