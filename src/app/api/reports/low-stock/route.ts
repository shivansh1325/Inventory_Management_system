import { db } from "@/lib/db";
import { fmtQty, fmtMoney, mulQty } from "@/lib/qty";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || !can(session.role, "export.data")) {
    return new Response("Forbidden", { status: 403 });
  }
  const components = await db.component.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  const low = components.filter((c) => c.stockQty <= c.minLevel);

  const header = ["SKU", "Component", "Unit", "In stock", "Min level", "Suggested reorder", "Est. cost", "Supplier", "Location"];
  const rows = low.map((c) => {
    const suggested = Math.max(0, c.minLevel * 2 - c.stockQty);
    return [
      c.sku,
      `"${c.name.replaceAll('"', '""')}"`,
      c.unit,
      fmtQty(c.stockQty),
      fmtQty(c.minLevel),
      fmtQty(suggested),
      c.unitCost != null ? fmtMoney(mulQty(suggested, c.unitCost)) : "",
      c.supplier ?? "",
      c.location ?? "",
    ].join(",");
  });

  return new Response([header.join(","), ...rows].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="low-stock-reorder.csv"`,
    },
  });
}
