import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { fmtQty } from "@/lib/qty";
import { buildMovementWhere } from "@/lib/movement-filter";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function csvCell(v: string | null | undefined): string {
  const s = v ?? "";
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !can(session.role, "export.data")) {
    return new Response("Forbidden", { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  const where = buildMovementWhere({
    type: sp.get("type") ?? undefined,
    item: sp.get("item") ?? undefined,
    warehouse: sp.get("warehouse") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  });

  const [movements, runs] = await Promise.all([
    db.stockMovement.findMany({
      where,
      include: { component: true, product: true },
      orderBy: { createdAt: "desc" },
    }),
    db.productionRun.findMany({ select: { id: true, runNo: true } }),
  ]);
  const runNoById = new Map(runs.map((r) => [r.id, r.runNo]));

  const header = ["Date", "Item", "Item type", "SKU", "Movement type", "Qty change", "Unit", "Balance after", "Ref", "Reason"];
  const rows = movements.map((m) => {
    const item = m.component ?? m.product;
    return [
      m.createdAt.toISOString(),
      csvCell(item?.name),
      m.componentId ? "component" : "product",
      csvCell(item?.sku),
      m.type,
      fmtQty(m.qtyChange),
      item?.unit ?? "",
      fmtQty(m.balanceAfter),
      m.refType === "ProductionRun" && m.refId ? (runNoById.get(m.refId) ?? "") : "",
      csvCell(m.reason),
    ].join(",");
  });

  const csv = [header.join(","), ...rows].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stock-movements.csv"`,
    },
  });
}
