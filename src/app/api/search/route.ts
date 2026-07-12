import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fmtQty } from "@/lib/qty";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ hits: [] });

  const [components, products, runs] = await Promise.all([
    db.component.findMany({
      where: { OR: [{ name: { contains: q } }, { sku: { contains: q } }] },
      take: 6,
    }),
    db.product.findMany({
      where: { OR: [{ name: { contains: q } }, { sku: { contains: q } }] },
      take: 6,
    }),
    db.productionRun.findMany({
      where: { runNo: { contains: q } },
      include: { product: true },
      take: 4,
    }),
  ]);

  const hits = [
    ...components.map((c) => ({
      kind: "component" as const,
      id: c.id,
      title: c.name,
      subtitle: `${c.sku} · ${fmtQty(c.stockQty)} ${c.unit} in stock`,
      href: `/components?focus=${c.id}`,
    })),
    ...products.map((p) => ({
      kind: "product" as const,
      id: p.id,
      title: p.name,
      subtitle: p.sku,
      href: `/products/${p.id}`,
    })),
    ...runs.map((r) => ({
      kind: "run" as const,
      id: r.id,
      title: `${r.runNo} — ${r.product.name}`,
      subtitle: `${r.status} · ${fmtQty(r.qtyToProduce)} ${r.product.unit}`,
      href: `/production/${r.id}`,
    })),
  ];
  return NextResponse.json({ hits: hits.slice(0, 12) });
}
