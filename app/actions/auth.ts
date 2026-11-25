"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";
import { checkThrottle, recordFailedAttempt, recordSuccess, getClientIdentifier, formatRetryAfter } from "@/lib/loginThrottle";

export type AuthFormState = { error?: string } | undefined;

export async function siteLoginAction(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const invite = String(formData.get("invite") ?? "").trim();
  const next = String(formData.get("next") ?? "/");

  if (invite) {
    const record = await db.accessInvite.findUnique({ where: { token: invite } });
    if (record && !record.revoked) {
      await db.accessInvite.update({
        where: { token: invite },
        data: { lastUsedAt: new Date() },
      });
      await createSession("viewer");
      redirect(next || "/");
    }
    return { error: "That invite link is invalid or has been revoked." };
  }

  const identifier = await getClientIdentifier();

  // The master password always works, even mid-lockout — it's the owner's
  // override and isn't subject to the same brute-force throttle as the
  // regular site password (see isAdminOrAbove / MASTER_PASSWORD docs).
  if (password && process.env.MASTER_PASSWORD && password === process.env.MASTER_PASSWORD) {
    await recordSuccess("site", identifier);
    await createSession("master");
    redirect(next || "/");
  }

  const throttle = await checkThrottle("site", identifier);
  if (throttle.locked) {
    return { error: `Too many failed attempts. Try again in ${formatRetryAfter(throttle.retryAfterSeconds)}.` };
  }

  if (password && password === process.env.SITE_PASSWORD) {
    await recordSuccess("site", identifier);
    await createSession("viewer");
    redirect(next || "/");
  }

  const result = await recordFailedAttempt("site", identifier);
  if (result.locked) {
    return { error: `Too many failed attempts. Try again in ${formatRetryAfter(result.retryAfterSeconds)}.` };
  }
  return { error: "Incorrect password." };
}

export async function adminLoginAction(
  _state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const identifier = await getClientIdentifier();

  if (password && process.env.MASTER_PASSWORD && password === process.env.MASTER_PASSWORD) {
    await recordSuccess("admin", identifier);
    await createSession("master");
    redirect("/admin");
  }

  const throttle = await checkThrottle("admin", identifier);
  if (throttle.locked) {
    return { error: `Too many failed attempts. Try again in ${formatRetryAfter(throttle.retryAfterSeconds)}.` };
  }

  if (password && password === process.env.ADMIN_PASSWORD) {
    await recordSuccess("admin", identifier);
    await createSession("admin");
    redirect("/admin");
  }

  const result = await recordFailedAttempt("admin", identifier);
  if (result.locked) {
    return { error: `Too many failed attempts. Try again in ${formatRetryAfter(result.retryAfterSeconds)}.` };
  }
  return { error: "Incorrect admin password." };
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
