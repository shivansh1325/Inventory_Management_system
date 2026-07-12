import { db } from "@/lib/db";
import { can, type Action, type Role } from "@/lib/permissions";

/** Create an in-app notification for every active user allowed to act on it. */
export async function notifyByPermission(
  action: Action,
  data: { type: string; message: string; href?: string },
  excludeUserId?: string,
) {
  try {
    const users = await db.user.findMany({ where: { isActive: true } });
    const targets = users.filter(
      (u) => u.id !== excludeUserId && can(u.role as Role, action),
    );
    if (targets.length === 0) return;
    await db.notification.createMany({
      data: targets.map((u) => ({
        userId: u.id,
        type: data.type,
        message: data.message,
        href: data.href ?? null,
      })),
    });
  } catch (e) {
    console.error("notify failed", e);
  }
}

export async function notifyUser(
  userId: string,
  data: { type: string; message: string; href?: string },
) {
  try {
    await db.notification.create({
      data: { userId, type: data.type, message: data.message, href: data.href ?? null },
    });
  } catch (e) {
    console.error("notify failed", e);
  }
}
