"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function markAllReadAction() {
  const me = await requireUser();
  await db.notification.updateMany({
    where: { userId: me.id, readAt: null },
    data: { readAt: new Date() },
  });
}
