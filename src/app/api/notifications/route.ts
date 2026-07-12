import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.notification.count({ where: { userId: session.id, readAt: null } }),
  ]);
  return NextResponse.json({ items, unread });
}
