import { PageHeader } from "@/components/page-header";
import { requirePagePermission } from "@/lib/page-guard";
import { getSettings } from "@/lib/settings";
import { fmtQty } from "@/lib/qty";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePagePermission("settings.manage");
  const s = await getSettings();

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Company-wide configuration — Admin only"
        crumbs={[{ label: "Administration" }, { label: "Settings" }]}
      />
      <SettingsForm
        initial={{
          companyName: s.companyName,
          currency: s.currency,
          managerApprovalLimit: fmtQty(s.managerApprovalLimit),
          allowNegativeStock: s.allowNegativeStock,
          lowStockAlerts: s.lowStockAlerts,
        }}
      />
    </>
  );
}
