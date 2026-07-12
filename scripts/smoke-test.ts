/**
 * Route smoke test against a running server (npm run start / dev).
 * Signs a session JWT per role and checks every page renders (200) or is
 * correctly gated (redirect). Run: npx tsx scripts/smoke-test.ts
 */
import { SignJWT } from "jose";
import { db } from "../src/lib/db";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);

async function tokenFor(email: string) {
  const u = await db.user.findUniqueOrThrow({ where: { email } });
  return new SignJWT({ uid: u.id, email: u.email, name: u.name, role: u.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

type Expect = "ok" | "redirect" | "forbidden";
const CASES: { role: string; email: string; routes: [string, Expect][] }[] = [
  {
    role: "ADMIN",
    email: "admin@demo.local",
    routes: [
      ["/", "ok"], ["/analytics", "ok"], ["/components", "ok"], ["/products", "ok"],
      ["/production", "ok"], ["/production/new", "ok"], ["/movements", "ok"],
      ["/purchasing", "ok"], ["/purchasing/new", "ok"], ["/transfers", "ok"],
      ["/warehouses", "ok"], ["/reports", "ok"], ["/admin/users", "ok"],
      ["/admin/audit", "ok"], ["/admin/settings", "ok"],
      ["/api/movements/export", "ok"], ["/api/reports/low-stock", "ok"],
    ],
  },
  {
    role: "MANAGER",
    email: "manager@demo.local",
    routes: [
      ["/", "ok"], ["/analytics", "ok"], ["/purchasing", "ok"],
      ["/admin/users", "redirect"], ["/admin/settings", "redirect"], ["/warehouses", "redirect"],
    ],
  },
  {
    role: "STORE",
    email: "store@demo.local",
    routes: [
      ["/", "ok"], ["/components", "ok"], ["/transfers", "ok"], ["/purchasing", "ok"],
      ["/admin/audit", "redirect"],
    ],
  },
  {
    role: "OPERATOR",
    email: "operator@demo.local",
    routes: [
      ["/", "ok"], ["/production/new", "ok"], ["/components", "ok"],
      ["/analytics", "redirect"], ["/purchasing", "redirect"], ["/admin/users", "redirect"],
      ["/api/movements/export", "forbidden"],
    ],
  },
];

async function main() {
  let failures = 0;

  // Unauthenticated → login redirect.
  const anon = await fetch(`${BASE}/components`, { redirect: "manual" });
  if (anon.status !== 307 && anon.status !== 302) {
    failures++;
    console.error(`FAIL anon /components: expected redirect, got ${anon.status}`);
  } else {
    console.log("✓ anonymous request redirected to /login");
  }
  const login = await fetch(`${BASE}/login`);
  if (login.status !== 200) {
    failures++;
    console.error(`FAIL /login: ${login.status}`);
  } else {
    console.log("✓ /login renders");
  }

  for (const c of CASES) {
    const token = await tokenFor(c.email);
    for (const [route, expect] of c.routes) {
      const res = await fetch(`${BASE}${route}`, {
        headers: { cookie: `session=${token}` },
        redirect: "manual",
      });
      const ok =
        expect === "ok"
          ? res.status === 200
          : expect === "forbidden"
            ? res.status === 403
            : res.status === 307 || res.status === 302;
      if (!ok) {
        failures++;
        console.error(`FAIL ${c.role} ${route}: expected ${expect}, got ${res.status}`);
      }
    }
    console.log(`✓ ${c.role}: ${c.routes.length} routes behave as expected`);
  }

  if (failures > 0) {
    console.error(`\n${failures} smoke check(s) failed`);
    process.exit(1);
  }
  console.log("\nALL SMOKE TESTS PASSED");
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
