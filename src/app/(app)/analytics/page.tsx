import { PageHeader } from "@/components/page-header";
import { requirePagePermission } from "@/lib/page-guard";
import { getAnalyticsData } from "@/lib/analytics";
import { getSettings } from "@/lib/settings";
import { AnalyticsClient } from "./analytics-client";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requirePagePermission("analytics.view");
  const [data, settings] = await Promise.all([getAnalyticsData(), getSettings()]);

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Manufacturing intelligence computed from the movement ledger"
        crumbs={[{ label: "Overview" }, { label: "Analytics" }]}
      />
      <AnalyticsClient data={data} currency={settings.currency} />
    </>
  );
}
