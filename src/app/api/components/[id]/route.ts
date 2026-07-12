import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Component detail for the drawer: per-warehouse levels + recent movements. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [component, movements] = await Promise.all([
    db.component.findUnique({
      where: { id: params.id },
      include: { stockLevels: { include: { warehouse: true } } },
    }),
    db.stockMovement.findMany({
      where: { componentId: params.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { warehouse: true },
    }),
  ]);
  if (!component) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    levels: component.stockLevels.map((l) => ({
      warehouse: l.warehouse.name,
      qty: l.qty,
    })),
    movements: movements.map((m) => ({
      id: m.id,
      type: m.type,
      qtyChange: m.qtyChange,
      balanceAfter: m.balanceAfter,
      warehouse: m.warehouse?.name ?? null,
      reason: m.reason,
      createdBy: m.createdBy,
      createdAt: m.createdAt,
    })),
  });
}
