import {
  LayoutDashboard,
  LineChart,
  Boxes,
  Package,
  Warehouse,
  Factory,
  History,
  ShoppingCart,
  ArrowLeftRight,
  ClipboardList,
  Users,
  Settings,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { can, type Role } from "@/lib/permissions";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { title: string; items: NavItem[] };

/** Role-scoped navigation. Operators get a deliberately small, task-focused menu. */
export function navForRole(role: Role): NavGroup[] {
  const groups: NavGroup[] = [
    {
      title: "Overview",
      items: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard },
        ...(can(role, "analytics.view")
          ? [{ href: "/analytics", label: "Analytics", icon: LineChart }]
          : []),
      ],
    },
    {
      title: "Inventory",
      items: [
        { href: "/components", label: "Components", icon: Boxes },
        ...(role !== "OPERATOR" ? [{ href: "/products", label: "Products & BOM", icon: Package }] : []),
        ...(can(role, "warehouse.manage")
          ? [{ href: "/warehouses", label: "Warehouses", icon: Warehouse }]
          : []),
      ],
    },
    {
      title: "Operations",
      items: [
        ...(can(role, "runs.create") ? [{ href: "/production", label: "Production", icon: Factory }] : []),
        ...(role !== "OPERATOR" ? [{ href: "/movements", label: "Movements", icon: History }] : []),
        ...(can(role, "purchasing.raise")
          ? [{ href: "/purchasing", label: "Purchasing", icon: ShoppingCart }]
          : []),
        ...(can(role, "warehouse.transfer")
          ? [{ href: "/transfers", label: "Transfers", icon: ArrowLeftRight }]
          : []),
      ],
    },
    ...(role !== "OPERATOR"
      ? [{ title: "Reports", items: [{ href: "/reports", label: "Low stock / Reorder", icon: ClipboardList }] }]
      : []),
    ...(can(role, "users.manage")
      ? [
          {
            title: "Administration",
            items: [
              { href: "/admin/users", label: "Users & Roles", icon: Users },
              { href: "/admin/settings", label: "Settings", icon: Settings },
              { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
            ],
          },
        ]
      : []),
  ];
  return groups.filter((g) => g.items.length > 0);
}
