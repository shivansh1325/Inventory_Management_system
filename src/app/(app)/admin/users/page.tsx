import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { requirePagePermission } from "@/lib/page-guard";
import { UsersClient } from "./users-client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requirePagePermission("users.manage");
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <>
      <PageHeader
        title="Users & Roles"
        subtitle="Accounts are deactivated, never deleted — the audit trail keeps its actors"
        crumbs={[{ label: "Administration" }, { label: "Users & Roles" }]}
      />
      <UsersClient
        meId={me.id}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
          mustChangePassword: u.mustChangePassword,
        }))}
      />
    </>
  );
}
