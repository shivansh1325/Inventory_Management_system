import { redirect } from "next/navigation";
import { requireUser, type SessionUser } from "@/lib/auth";
import { can, type Action } from "@/lib/permissions";

/** Server-component gate: user lacking the permission is bounced to the dashboard. */
export async function requirePagePermission(action: Action): Promise<SessionUser> {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login");
  if (!can(user.role, action)) redirect("/");
  return user;
}
