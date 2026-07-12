import { redirect } from "next/navigation";
import Link from "next/link";
import { KeyRound } from "lucide-react";
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
        {user.mustChangePassword && (
          <div className="no-print flex items-center gap-2 border-b border-amber-300/60 bg-amber-50 px-6 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
            <KeyRound className="h-4 w-4 shrink-0" />
            You're using a temporary password.
            <Link href="/change-password" className="font-semibold underline underline-offset-2">
              Set your own now
            </Link>
          </div>
        )}
        <main className="min-w-0 flex-1 px-6 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
