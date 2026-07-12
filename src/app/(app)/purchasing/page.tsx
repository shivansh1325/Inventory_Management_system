import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { requirePagePermission } from "@/lib/page-guard";
import { can } from "@/lib/permissions";
import { fmtMoney } from "@/lib/qty";
import { requisitionValue } from "@/lib/services/purchasing";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ShoppingCart } from "lucide-react";
import { SuppliersSection } from "./suppliers-section";

export const dynamic = "force-dynamic";

export default async function PurchasingPage() {
  const user = await requirePagePermission("purchasing.raise");
  const [requisitions, suppliers] = await Promise.all([
    db.purchaseRequisition.findMany({
      include: { lines: true, supplier: true, warehouse: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Purchasing"
        subtitle="Requisitions close the loop on shortages: raise → approve → order → receive"
        crumbs={[{ label: "Operations" }, { label: "Purchasing" }]}
        actions={
          <Link
            href="/purchasing/new"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
          >
            + New requisition
          </Link>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Requisitions</CardTitle>
          <CardDescription>
            {requisitions.filter((r) => r.status === "PENDING_APPROVAL").length} awaiting approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requisitions.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No requisitions yet"
              description="Raise one manually, from the low-stock report, or straight from a blocked production run."
              action={
                <Link
                  href="/purchasing/new"
                  className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
                >
                  New requisition
                </Link>
              }
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>No.</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Lines</TH>
                  <TH className="text-right">Est. value</TH>
                  <TH>Warehouse</TH>
                  <TH>Supplier</TH>
                  <TH>Raised by</TH>
                  <TH>Date</TH>
                </TR>
              </THead>
              <TBody>
                {requisitions.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/purchasing/${r.id}`} className="font-mono text-xs font-semibold text-primary hover:underline dark:text-indigo-300">
                        {r.prNo}
                      </Link>
                    </TD>
                    <TD><StatusBadge status={r.status} /></TD>
                    <TD className="text-right tabular-nums text-slate-500">{r.lines.length}</TD>
                    <TD className="text-right tabular-nums font-semibold">{fmtMoney(requisitionValue(r.lines))}</TD>
                    <TD className="text-slate-500">{r.warehouse.name}</TD>
                    <TD className="text-slate-500">{r.supplier?.name ?? "—"}</TD>
                    <TD className="text-slate-500">{r.raisedByName ?? "—"}</TD>
                    <TD className="text-xs text-slate-500">
                      {r.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SuppliersSection
        suppliers={suppliers.map((s) => ({
          id: s.id,
          name: s.name,
          contact: s.contact,
          email: s.email,
          phone: s.phone,
          terms: s.terms,
          leadTimeDays: s.leadTimeDays,
        }))}
        canEdit={can(user.role, "purchasing.raise")}
      />
    </>
  );
}
