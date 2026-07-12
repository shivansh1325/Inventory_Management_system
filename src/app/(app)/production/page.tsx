import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { fmtQty } from "@/lib/qty";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Factory } from "lucide-react";
import { ReverseRunButton } from "./reverse-button";

export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const user = await requireUser();
  const canReverse = can(user.role, "runs.reverse");
  const runs = await db.productionRun.findMany({
    include: { product: true, warehouse: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader
        title="Production"
        subtitle="Build runs — completing a run automatically deducts BOM components from stock"
        crumbs={[{ label: "Operations" }, { label: "Production" }]}
        actions={
          <Link
            href="/production/new"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
          >
            + New production run
          </Link>
        }
      />
      <div className="rounded-card border border-slate-200 bg-surface shadow-card">
        {runs.length === 0 ? (
          <EmptyState
            icon={Factory}
            title="No production runs yet"
            description="Start your first run — components are checked and deducted automatically."
            action={
              <Link
                href="/production/new"
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
              >
                New production run
              </Link>
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Run</TH>
                <TH>Product</TH>
                <TH className="text-right">Qty</TH>
                <TH>Warehouse</TH>
                <TH>Status</TH>
                <TH>By</TH>
                <TH>Date</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {runs.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Link
                      href={`/production/${r.id}`}
                      className="font-mono text-xs font-semibold text-primary hover:underline dark:text-indigo-300"
                    >
                      {r.runNo}
                    </Link>
                  </TD>
                  <TD className="font-medium">{r.product.name}</TD>
                  <TD className="text-right font-semibold tabular-nums">
                    {fmtQty(r.qtyToProduce)}{" "}
                    <span className="text-xs font-normal text-slate-400">{r.product.unit}</span>
                  </TD>
                  <TD className="text-slate-500">{r.warehouse?.name ?? "—"}</TD>
                  <TD><StatusBadge status={r.status} /></TD>
                  <TD className="text-slate-500">{r.createdBy ?? "—"}</TD>
                  <TD className="text-slate-500">
                    {(r.producedAt ?? r.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </TD>
                  <TD className="text-right">
                    {r.status === "COMPLETED" && canReverse && (
                      <ReverseRunButton runId={r.id} runNo={r.runNo} />
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </>
  );
}
