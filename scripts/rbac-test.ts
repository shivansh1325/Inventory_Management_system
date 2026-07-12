/**
 * RBAC matrix test — asserts the permission map matches the spec table
 * for every role × action. Run: npx tsx scripts/rbac-test.ts
 */
import { can, canApproveValue, ACTIONS, ROLES, type Action, type Role } from "../src/lib/permissions";

// Spec matrix: action -> roles allowed.
const EXPECTED: Record<Action, Role[]> = {
  "users.manage": ["ADMIN"],
  "settings.manage": ["ADMIN"],
  "audit.view": ["ADMIN"],
  "components.write": ["ADMIN", "MANAGER", "STORE"],
  "components.archive": ["ADMIN", "MANAGER"],
  "stock.receive": ["ADMIN", "MANAGER", "STORE"],
  "stock.adjust": ["ADMIN", "MANAGER"],
  "products.write": ["ADMIN", "MANAGER"],
  "runs.create": ["ADMIN", "MANAGER", "OPERATOR"],
  "runs.reverse": ["ADMIN", "MANAGER"],
  "purchasing.raise": ["ADMIN", "MANAGER", "STORE"],
  "purchasing.approve": ["ADMIN", "MANAGER"],
  "purchasing.receive": ["ADMIN", "MANAGER", "STORE"],
  "warehouse.manage": ["ADMIN"],
  "warehouse.transfer": ["ADMIN", "MANAGER", "STORE"],
  "analytics.view": ["ADMIN", "MANAGER", "STORE"],
  "export.data": ["ADMIN", "MANAGER", "STORE"],
};

let failures = 0;
for (const action of ACTIONS) {
  for (const role of ROLES) {
    const expected = EXPECTED[action].includes(role);
    const actual = can(role, action);
    if (expected !== actual) {
      failures++;
      console.error(`FAIL: ${role} × ${action} — expected ${expected}, got ${actual}`);
    }
  }
}

// Value-limited approvals.
const LIMIT = 50_000_000; // 50,000.000 in milli
const checks: [boolean, string][] = [
  [canApproveValue("ADMIN", LIMIT * 10, LIMIT) === true, "Admin approves any value"],
  [canApproveValue("MANAGER", LIMIT, LIMIT) === true, "Manager approves at the limit"],
  [canApproveValue("MANAGER", LIMIT + 1, LIMIT) === false, "Manager blocked above the limit"],
  [canApproveValue("STORE", 1, LIMIT) === false, "Store cannot approve"],
  [canApproveValue("OPERATOR", 1, LIMIT) === false, "Operator cannot approve"],
];
for (const [ok, label] of checks) {
  if (!ok) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} RBAC assertion(s) failed`);
  process.exit(1);
}
console.log(`✓ RBAC matrix: ${ACTIONS.length * ROLES.length} role×action pairs + value-limit rules all match the spec`);
