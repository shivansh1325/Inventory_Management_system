"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { navForRole } from "@/components/shell/nav-config";
import { BRAND } from "@/lib/brand";
import type { Role } from "@/lib/permissions";

export function AppSidebar({ role }: { role: Role; companyName?: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      localStorage.setItem("sidebar-collapsed", c ? "0" : "1");
      return !c;
    });

  const groups = navForRole(role);

  return (
    <aside
      className={cn(
        "no-print sticky top-0 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-surface transition-[width] duration-150",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <div className={cn("flex items-center gap-2.5 py-4", collapsed ? "justify-center px-2" : "px-4")}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND.logoUrl} alt={BRAND.company} className="h-full w-full object-contain" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-bold leading-tight text-slate-900">{BRAND.company}</div>
            <div className="text-xs text-slate-500">{BRAND.product}</div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-2">
        {groups.map((g) => (
          <div key={g.title}>
            {!collapsed && (
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {g.title}
              </div>
            )}
            <div className="space-y-0.5">
              {g.items.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors",
                      collapsed ? "justify-center px-0" : "px-2.5",
                      active
                        ? "bg-primary-soft text-primary dark:text-slate-900"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <button
        onClick={toggle}
        className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-400 hover:text-slate-600"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        {!collapsed && "Collapse"}
      </button>
    </aside>
  );
}
