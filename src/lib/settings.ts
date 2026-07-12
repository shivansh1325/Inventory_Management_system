import { db } from "@/lib/db";

/** Singleton app settings row, created on first read. */
export async function getSettings() {
  return db.appSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

export async function getDefaultWarehouse() {
  const wh =
    (await db.warehouse.findFirst({ where: { isDefault: true, isActive: true } })) ??
    (await db.warehouse.findFirst({ where: { isActive: true } }));
  if (!wh) throw new Error("No active warehouse configured");
  return wh;
}
