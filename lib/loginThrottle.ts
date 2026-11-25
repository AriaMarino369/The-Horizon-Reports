import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";

export type LoginScope = "site" | "admin";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 10;

/** Best-effort caller IP from the headers a proxy/CDN sets — falls back to a shared bucket if none are present (e.g. local dev without a proxy in front). */
export async function getClientIdentifier(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export type ThrottleStatus = { locked: false } | { locked: true; retryAfterSeconds: number };

/** Checks whether this (scope, identifier) is currently locked out — does not itself record anything. */
export async function checkThrottle(scope: LoginScope, identifier: string): Promise<ThrottleStatus> {
  const row = await db.loginThrottle.findUnique({ where: { scope_identifier: { scope, identifier } } });
  if (row?.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
    return { locked: true, retryAfterSeconds: Math.ceil((row.lockedUntil.getTime() - Date.now()) / 1000) };
  }
  return { locked: false };
}

/**
 * Records a failed attempt. Once attempts reaches MAX_ATTEMPTS, sets a
 * LOCKOUT_MINUTES lock and resets the counter, so the next window after the
 * lock expires starts fresh rather than locking again on the very next try.
 */
export async function recordFailedAttempt(scope: LoginScope, identifier: string): Promise<ThrottleStatus> {
  const existing = await db.loginThrottle.findUnique({ where: { scope_identifier: { scope, identifier } } });
  const previousAttempts = existing?.lockedUntil && existing.lockedUntil.getTime() > Date.now() ? existing.attempts : existing?.attempts ?? 0;
  const attempts = previousAttempts + 1;

  if (attempts >= MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    await db.loginThrottle.upsert({
      where: { scope_identifier: { scope, identifier } },
      create: { scope, identifier, attempts: 0, lockedUntil },
      update: { attempts: 0, lockedUntil },
    });
    return { locked: true, retryAfterSeconds: LOCKOUT_MINUTES * 60 };
  }

  await db.loginThrottle.upsert({
    where: { scope_identifier: { scope, identifier } },
    create: { scope, identifier, attempts },
    update: { attempts, lockedUntil: null },
  });
  return { locked: false };
}

/** Clears any attempt count / lock for this (scope, identifier) — called on a successful login. */
export async function recordSuccess(scope: LoginScope, identifier: string): Promise<void> {
  await db.loginThrottle.upsert({
    where: { scope_identifier: { scope, identifier } },
    create: { scope, identifier, attempts: 0, lockedUntil: null },
    update: { attempts: 0, lockedUntil: null },
  });
}

export function formatRetryAfter(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "1 minute" : `${minutes} minutes`;
}

export const LOGIN_MAX_ATTEMPTS = MAX_ATTEMPTS;
