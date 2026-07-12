import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { can, type Action, type Role, ROLES } from "@/lib/permissions";

const COOKIE = "session";
const MAX_AGE_S = 60 * 60 * 12; // 12h

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    uid: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_S,
    path: "/",
  });
}

export function destroySession() {
  cookies().delete(COOKIE);
}

/** Session from cookie only (fast, no DB). Role may be stale — use requireUser for mutations. */
export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const role = payload.role as string;
    if (!ROLES.includes(role as Role)) return null;
    return {
      id: payload.uid as string,
      email: payload.email as string,
      name: payload.name as string,
      role: role as Role,
    };
  } catch {
    return null;
  }
}

export class AuthError extends Error {
  constructor(message = "Not authorized") {
    super(message);
  }
}

/**
 * DB-verified current user — the source of truth for mutations.
 * Rejects deactivated users immediately (not just at token expiry) and
 * picks up role changes without re-login.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AuthError("Not signed in");
  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user || !user.isActive) throw new AuthError("Account is deactivated");
  return { id: user.id, email: user.email, name: user.name, role: user.role as Role };
}

/** Server-side permission gate — every mutating server action goes through this. */
export async function requirePermission(action: Action): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, action)) {
    throw new AuthError(`Your role (${user.role}) is not allowed to: ${action}`);
  }
  return user;
}
