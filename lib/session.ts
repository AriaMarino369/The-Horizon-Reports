import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type Role = "viewer" | "admin";
type SessionPayload = { role: Role; loginAt: number };

const COOKIE_NAME = "fgi_session";

// Absolute ceiling on a session's total lifetime, regardless of activity —
// a session can't outlive this even if continuously refreshed by the idle
// timeout below.
const ABSOLUTE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

// Sliding inactivity window, per role — a session is logged out if no
// request comes in within this window, and the window resets (the cookie
// is reissued) on every request that does, via the Proxy. Admin gets a
// longer window since it's actively used for longer editing sessions;
// viewer is the public reading gate, so a shorter window matters more.
const IDLE_TIMEOUT_SECONDS: Record<Role, number> = {
  admin: 60 * 60, // 1 hour
  viewer: 30 * 60, // 30 minutes
};

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET env var is not set");
  }
  return new TextEncoder().encode(secret);
}

async function encrypt(payload: SessionPayload, maxAgeSeconds: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secretKey());
}

async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(role: Role) {
  const idleSeconds = IDLE_TIMEOUT_SECONDS[role];
  const token = await encrypt({ role, loginAt: Date.now() }, idleSeconds);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: idleSeconds,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return decrypt(store.get(COOKIE_NAME)?.value);
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** For use in Proxy, where only the raw cookie string (not the async `cookies()` API) is available. */
export async function decryptCookieValue(value: string | undefined) {
  return decrypt(value);
}

/**
 * Re-signs a still-valid (not idle-expired) session with a fresh idle
 * window, preserving the original `loginAt`. Called from the Proxy on
 * every authenticated request so the inactivity clock resets on activity —
 * this is what makes the timeout "idle" rather than fixed-length. Returns
 * null if the session has hit its absolute lifetime ceiling even though
 * it hasn't gone idle; the caller should treat that the same as an
 * expired/invalid session (force a fresh login).
 */
export async function refreshSession(
  payload: SessionPayload
): Promise<{ token: string; maxAgeSeconds: number } | null> {
  if (Date.now() - payload.loginAt > ABSOLUTE_MAX_AGE_SECONDS * 1000) {
    return null;
  }
  const idleSeconds = IDLE_TIMEOUT_SECONDS[payload.role];
  const token = await encrypt({ role: payload.role, loginAt: payload.loginAt }, idleSeconds);
  return { token, maxAgeSeconds: idleSeconds };
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
