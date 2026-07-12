/**
 * RBAC as data. Admin is the top role — no super admin above it.
 * Adjust a role by editing this map; nothing else needs to change.
 */

export const ROLES = ["ADMIN", "MANAGER", "STORE", "OPERATOR"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Production Manager",
  STORE: "Store Keeper",
  OPERATOR: "Operator",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Full control: users, settings, audit log, every operation.",
  MANAGER:
    "Runs production: components, products & BOMs, stock, runs (incl. reverse), requisition approval below the value limit.",
  STORE: "Keeps the store: components, receipts, transfers, goods receipt, raises requisitions. No adjustments or BOM edits.",
  OPERATOR: "Shop floor: sees the dashboard and stock, creates production runs. Read-only otherwise.",
};

export const ACTIONS = [
  "users.manage",
  "settings.manage",
  "audit.view",
  "components.write",
  "components.archive",
  "stock.receive",
  "stock.adjust",
  "products.write",
  "runs.create",
  "runs.reverse",
  "purchasing.raise",
  "purchasing.approve",
  "purchasing.receive",
  "warehouse.manage",
  "warehouse.transfer",
  "analytics.view",
  "export.data",
] as const;
export type Action = (typeof ACTIONS)[number];

const M: Record<Role, Action[]> = {
  ADMIN: [...ACTIONS],
  MANAGER: [
    "components.write",
    "components.archive",
    "stock.receive",
    "stock.adjust",
    "products.write",
    "runs.create",
    "runs.reverse",
    "purchasing.raise",
    "purchasing.approve", // value-limited — see canApproveValue()
    "purchasing.receive",
    "warehouse.transfer",
    "analytics.view",
    "export.data",
  ],
  STORE: [
    "components.write",
    "stock.receive",
    "purchasing.raise",
    "purchasing.receive",
    "warehouse.transfer",
    "analytics.view",
    "export.data",
  ],
  OPERATOR: ["runs.create"],
};

export const PERMISSIONS: Record<Role, ReadonlySet<Action>> = {
  ADMIN: new Set(M.ADMIN),
  MANAGER: new Set(M.MANAGER),
  STORE: new Set(M.STORE),
  OPERATOR: new Set(M.OPERATOR),
};

export function can(role: Role, action: Action): boolean {
  return PERMISSIONS[role]?.has(action) ?? false;
}

/** Manager approvals are capped at the Admin-configured value limit. */
export function canApproveValue(role: Role, valueMilli: number, limitMilli: number): boolean {
  if (role === "ADMIN") return true;
  if (role === "MANAGER") return valueMilli <= limitMilli;
  return false;
}
