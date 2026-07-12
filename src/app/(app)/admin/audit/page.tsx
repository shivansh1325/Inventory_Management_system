import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { requirePagePermission } from "@/lib/page-guard";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { action?: string; actor?: string; page?: string };
}) {
  await requirePagePermission("audit.view");
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  const where: Record<string, unknown> = {};
  if (searchParams.action) where.action = { contains: searchParams.action };
  if (searchParams.actor) where.actorName = { contains: searchParams.actor };

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (searchParams.action) params.set("action", searchParams.action);
    if (searchParams.actor) params.set("actor", searchParams.actor);
    params.set("page", String(p));
    return `?${params.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle={`Who did what, when — ${total} entries`}
        crumbs={[{ label: "Administration" }, { label: "Audit Log" }]}
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Action contains</label>
          <input name="action" defaultValue={searchParams.action ?? ""} placeholder="e.g. stock.adjust" className="h-9 rounded-md border border-slate-300 bg-surface px-2.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Actor contains</label>
          <input name="actor" defaultValue={searchParams.actor ?? ""} className="h-9 rounded-md border border-slate-300 bg-surface px-2.5 text-sm" />
        </div>
        <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover">Filter</button>
        <Link href="/admin/audit" className="h-9 rounded-md px-3 py-2 text-sm text-slate-500 hover:text-slate-700">Reset</Link>
      </form>

      <div className="rounded-card border border-slate-200 bg-surface shadow-card">
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Actor</TH>
              <TH>Action</TH>
              <TH>Entity</TH>
              <TH>Detail</TH>
            </TR>
          </THead>
          <TBody>
            {logs.length === 0 ? (
              <TR><TD colSpan={5} className="py-10 text-center text-slate-400">No entries.</TD></TR>
            ) : (
              logs.map((l) => (
                <TR key={l.id}>
                  <TD className="whitespace-nowrap text-xs text-slate-500">
                    {l.createdAt.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </TD>
                  <TD className="font-medium">{l.actorName ?? "system"}</TD>
                  <TD><Badge tone={l.action.includes("blocked") || l.action.includes("reject") ? "out" : l.action.includes("approve") || l.action.includes("create") ? "ok" : "neutral"}>{l.action}</Badge></TD>
                  <TD className="text-xs text-slate-500">{l.entityType ?? "—"}</TD>
                  <TD className="max-w-[26rem] truncate font-mono text-xs text-slate-500" title={l.detail ?? undefined}>
                    {l.detail ?? "—"}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            <span>Page {page} of {pageCount}</span>
            <span className="flex gap-2">
              {page > 1 && <Link href={qs(page - 1)} className="inline-flex items-center gap-1 text-primary hover:underline dark:text-indigo-300"><ChevronLeft className="h-3.5 w-3.5" /> Prev</Link>}
              {page < pageCount && <Link href={qs(page + 1)} className="inline-flex items-center gap-1 text-primary hover:underline dark:text-indigo-300">Next <ChevronRight className="h-3.5 w-3.5" /></Link>}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
