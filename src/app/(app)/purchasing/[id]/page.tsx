import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { requirePagePermission } from "@/lib/page-guard";
import { can, canApproveValue } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { fmtMoney } from "@/lib/qty";
import { requisitionValue } from "@/lib/services/purchasing";
import { StatusBadge } from "@/components/ui/badge";
import { RequisitionDetailClient } from "./requisition-detail-client";

export const dynamic = "force-dynamic";

export default async function RequisitionDetailPage({ params }: { params: { id: string } }) {
  const user = await requirePagePermission("purchasing.raise");
  const [pr, settings] = await Promise.all([
    db.purchaseRequisition.findUnique({
      where: { id: params.id },
      include: { lines: { include: { component: true } }, supplier: true, warehouse: true },
    }),
    getSettings(),
  ]);
  if (!pr) notFound();

  const value = requisitionValue(pr.lines);
  const mayApprove =
    can(user.role, "purchasing.approve") &&
    canApproveValue(user.role, value, settings.managerApprovalLimit);

  return (
    <>
      <PageHeader
        title={`Requisition ${pr.prNo}`}
        subtitle={`Est. value ${settings.currency} ${fmtMoney(value)} · deliver to ${pr.warehouse.name}${pr.supplier ? ` · ${pr.supplier.name}` : ""}`}
        crumbs={[
          { label: "Operations" },
          { label: "Purchasing", href: "/purchasing" },
          { label: pr.prNo },
        ]}
        actions={<StatusBadge status={pr.status} />}
      />
      <RequisitionDetailClient
        pr={{
          id: pr.id,
          prNo: pr.prNo,
          status: pr.status,
          note: pr.note,
          raisedByName: pr.raisedByName,
          decidedByName: pr.decidedByName,
          decidedAt: pr.decidedAt?.toISOString() ?? null,
          decisionComment: pr.decisionComment,
          createdAt: pr.createdAt.toISOString(),
          lines: pr.lines.map((l) => ({
            id: l.id,
            componentName: l.component.name,
            componentSku: l.component.sku,
            unit: l.component.unit,
            qtyRequested: l.qtyRequested,
            qtyReceived: l.qtyReceived,
            estUnitCost: l.estUnitCost,
          })),
        }}
        perms={{
          approve: mayApprove,
          approveBlockedByLimit:
            can(user.role, "purchasing.approve") && !mayApprove,
          receive: can(user.role, "purchasing.receive"),
          raise: can(user.role, "purchasing.raise"),
        }}
        approvalLimitLabel={`${settings.currency} ${fmtMoney(settings.managerApprovalLimit)}`}
      />
    </>
  );
}
