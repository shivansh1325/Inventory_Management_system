/**
 * Production bootstrap — runs on every deploy (idempotent, never destructive).
 *   - ensures the AppSetting singleton exists
 *   - ensures a default warehouse exists
 *   - if the users table is EMPTY, creates the first Admin from
 *     ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME env vars
 *     (defaults: admin@demo.local / demo1234, forced password change)
 *
 * It never touches existing data — safe in the Render build command:
 *   npm install && npx prisma migrate deploy && npx tsx scripts/bootstrap.ts && npm run build
 *
 * For full DEMO data (components, BOMs, runs), run `npm run seed` manually
 * with DATABASE_URL pointing at the database — NOT in the build command
 * (the seed wipes and reloads everything).
 */
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";

async function main() {
  await db.appSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  console.log("✓ settings singleton present");

  const wh = await db.warehouse.findFirst();
  if (!wh) {
    await db.warehouse.create({
      data: { code: "MAIN", name: "Main Warehouse", isDefault: true },
    });
    console.log("✓ created Main Warehouse");
  } else {
    console.log("✓ warehouse exists");
  }

  const userCount = await db.user.count();
  if (userCount === 0) {
    const email = (process.env.ADMIN_EMAIL ?? "admin@demo.local").toLowerCase();
    const password = process.env.ADMIN_PASSWORD ?? "demo1234";
    const name = process.env.ADMIN_NAME ?? "Admin";
    await db.user.create({
      data: {
        email,
        name,
        role: "ADMIN",
        passwordHash: await bcrypt.hash(password, 10),
        // Force a change unless the operator explicitly set their own password.
        mustChangePassword: !process.env.ADMIN_PASSWORD,
      },
    });
    console.log(`✓ created first admin: ${email}${process.env.ADMIN_PASSWORD ? "" : " (default password demo1234 — change it after first login!)"}`);
  } else {
    console.log(`✓ ${userCount} user(s) exist — no admin created`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
