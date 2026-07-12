"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createSession,
  destroySession,
  verifyPassword,
  hashPassword,
  requireUser,
} from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { Role } from "@/lib/permissions";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginResult = { ok: boolean; error?: string; mustChangePassword?: boolean };

export async function loginAction(raw: unknown): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, error: "Invalid email or password" };
  }
  if (!user.isActive) {
    return { ok: false, error: "This account is deactivated — contact an administrator" };
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
  });
  await audit(
    { id: user.id, email: user.email, name: user.name, role: user.role as Role },
    "auth.login",
    "User",
    user.id,
  );
  return { ok: true, mustChangePassword: user.mustChangePassword };
}

export async function logoutAction() {
  destroySession();
  redirect("/login");
}

const changePasswordSchema = z.object({
  current: z.string().min(1, "Current password required"),
  next: z.string().min(8, "New password must be at least 8 characters"),
});

export async function changePasswordAction(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
  const me = await requireUser();
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) {
    return { ok: false, error: "Current password is incorrect" };
  }
  await db.user.update({
    where: { id: me.id },
    data: { passwordHash: await hashPassword(parsed.data.next), mustChangePassword: false },
  });
  await audit(me, "auth.password_change", "User", me.id);
  return { ok: true };
}
