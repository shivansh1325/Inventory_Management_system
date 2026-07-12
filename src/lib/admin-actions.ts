"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission, AuthError, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toMilli } from "@/lib/qty";
import { userSchema, warehouseSchema, settingsSchema, supplierSchema } from "@/lib/validation";

type Result = { ok: boolean; error?: string; tempPassword?: string };
const fail = (error: string): Result => ({ ok: false, error });
const isUnique = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
const authFail = (e: unknown): Result | null => (e instanceof AuthError ? fail(e.message) : null);
const revalidate = () => revalidatePath("/", "layout");

// ---------- Users ----------

export async function saveUser(id: string | null, raw: unknown): Promise<Result> {
  try {
    const actor = await requirePermission("users.manage");
    const parsed = userSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const d = parsed.data;
    try {
      if (id) {
        await db.user.update({
          where: { id },
          data: { name: d.name, email: d.email.toLowerCase(), role: d.role },
        });
        await audit(actor, "user.update", "User", id, { email: d.email, role: d.role });
      } else {
        if (!d.password) return fail("Password is required for a new user");
        const created = await db.user.create({
          data: {
            name: d.name,
            email: d.email.toLowerCase(),
            role: d.role,
            passwordHash: await hashPassword(d.password),
            mustChangePassword: true,
          },
        });
        await audit(actor, "user.create", "User", created.id, { email: d.email, role: d.role });
      }
    } catch (e) {
      if (isUnique(e)) return fail(`A user with email "${d.email}" already exists`);
      throw e;
    }
    revalidate();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

export async function setUserActive(id: string, active: boolean): Promise<Result> {
  try {
    const actor = await requirePermission("users.manage");
    if (id === actor.id && !active) return fail("You cannot deactivate your own account");
    const u = await db.user.update({ where: { id }, data: { isActive: active } });
    await audit(actor, active ? "user.reactivate" : "user.deactivate", "User", id, { email: u.email });
    revalidate();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

export async function forcePasswordReset(id: string): Promise<Result> {
  try {
    const actor = await requirePermission("users.manage");
    const temp = `Reset-${Math.random().toString(36).slice(2, 10)}`;
    const u = await db.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(temp), mustChangePassword: true },
    });
    await audit(actor, "user.force_reset", "User", id, { email: u.email });
    return { ok: true, tempPassword: temp };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

// ---------- Warehouses ----------

export async function saveWarehouse(id: string | null, raw: unknown): Promise<Result> {
  try {
    const actor = await requirePermission("warehouse.manage");
    const parsed = warehouseSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    try {
      if (id) {
        await db.warehouse.update({ where: { id }, data: parsed.data });
        await audit(actor, "warehouse.update", "Warehouse", id, parsed.data);
      } else {
        const created = await db.warehouse.create({ data: parsed.data });
        await audit(actor, "warehouse.create", "Warehouse", created.id, parsed.data);
      }
    } catch (e) {
      if (isUnique(e)) return fail(`Warehouse code "${parsed.data.code}" already exists`);
      throw e;
    }
    revalidate();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

export async function setDefaultWarehouseAction(id: string): Promise<Result> {
  try {
    const actor = await requirePermission("warehouse.manage");
    await db.$transaction([
      db.warehouse.updateMany({ data: { isDefault: false } }),
      db.warehouse.update({ where: { id }, data: { isDefault: true, isActive: true } }),
    ]);
    await audit(actor, "warehouse.set_default", "Warehouse", id);
    revalidate();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

// ---------- Suppliers ----------

export async function saveSupplier(id: string | null, raw: unknown): Promise<Result> {
  try {
    const actor = await requirePermission("purchasing.raise");
    const parsed = supplierSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const d = parsed.data;
    const data = {
      name: d.name,
      contact: d.contact || null,
      email: d.email || null,
      phone: d.phone || null,
      terms: d.terms || null,
      leadTimeDays: d.leadTimeDays ? parseInt(d.leadTimeDays, 10) : null,
    };
    if (id) {
      await db.supplier.update({ where: { id }, data });
      await audit(actor, "supplier.update", "Supplier", id, { name: d.name });
    } else {
      const created = await db.supplier.create({ data });
      await audit(actor, "supplier.create", "Supplier", created.id, { name: d.name });
    }
    revalidate();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}

// ---------- Settings ----------

export async function saveSettings(raw: unknown): Promise<Result> {
  try {
    const actor = await requirePermission("settings.manage");
    const parsed = settingsSchema.safeParse(raw);
    if (!parsed.success) return fail(parsed.error.errors[0].message);
    const d = parsed.data;
    await db.appSetting.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        companyName: d.companyName,
        currency: d.currency,
        managerApprovalLimit: toMilli(d.managerApprovalLimit),
        allowNegativeStock: d.allowNegativeStock,
        lowStockAlerts: d.lowStockAlerts,
      },
      update: {
        companyName: d.companyName,
        currency: d.currency,
        managerApprovalLimit: toMilli(d.managerApprovalLimit),
        allowNegativeStock: d.allowNegativeStock,
        lowStockAlerts: d.lowStockAlerts,
      },
    });
    await audit(actor, "settings.update", "AppSetting", "singleton", d);
    revalidate();
    return { ok: true };
  } catch (e) {
    return authFail(e) ?? fail(e instanceof Error ? e.message : "Failed");
  }
}
