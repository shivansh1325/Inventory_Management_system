import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

/**
 * One-line audit helper used by every mutation. Never throws — an audit
 * failure must not break the business operation (movements are the
 * financial trail; AuditLog is the who-did-what trail).
 */
export async function audit(
  actor: SessionUser | null,
  action: string,
  entityType?: string,
  entityId?: string,
  detail?: unknown,
) {
  try {
    await db.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? "system",
        action,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        detail: detail != null ? JSON.stringify(detail) : null,
      },
    });
  } catch (e) {
    console.error("audit write failed", e);
  }
}
