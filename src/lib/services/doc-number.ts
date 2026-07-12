import { Prisma } from "@prisma/client";

/**
 * Document numbers (PR-0001, REQ-0001) are derived from a count inside the
 * transaction. Two concurrent transactions can pick the same number on
 * PostgreSQL — the unique index rejects one with P2002 and the whole
 * transaction rolls back cleanly. Retrying the entire operation is the
 * correct fix: the retry re-reads the count (and re-checks stock), so
 * either it succeeds with the next number or fails for a real reason.
 */
export function isDocNumberCollision(e: unknown, field: string): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") return false;
  const target = e.meta?.target;
  return Array.isArray(target) ? target.includes(field) : String(target ?? "").includes(field);
}

export async function withDocNumberRetry<T>(field: string, fn: () => Promise<T>): Promise<T> {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt < MAX_ATTEMPTS && isDocNumberCollision(e, field)) continue;
      throw e;
    }
  }
}
