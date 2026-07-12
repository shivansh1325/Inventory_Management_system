import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { AppSidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import type { Role } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [user, settings] = await Promise.all([
    db.user.findUnique({ where: { id: session.id } }),
    getSettings(),
  ]);
  if (!user || !user.isActive) redirect("/login");

  const unreadCount = await db.notification.count({
    where: { userId: user.id, readAt: null },
  });

  return (
    <div className="flex min-h-screen">
      <AppSidebar role={user.role as Role} companyName={settings.companyName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={{ name: user.name, email: user.email, role: user.role as Role }}
          unreadCount={unreadCount}
        />
        <main className="min-w-0 flex-1 px-6 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
