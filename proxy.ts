import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decryptCookieValue, refreshSession, isAdminOrAbove, SESSION_COOKIE_NAME } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/admin/login"];

function withSessionCookie(response: NextResponse, token: string, maxAgeSeconds: number) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
  return response;
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    /\.(svg|png|jpg|jpeg|gif|ico|webmanifest)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // decryptCookieValue only succeeds while the sliding idle window hasn't
  // lapsed (the JWT's own `exp`). refreshSession() then enforces the
  // absolute lifetime ceiling independent of activity and, if the session
  // is still good on both counts, re-signs it with a fresh idle window —
  // this reset-on-every-request is what makes the timeout "idle" rather
  // than fixed-length.
  const session = await decryptCookieValue(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const refreshed = session ? await refreshSession(session) : null;

  if (pathname.startsWith("/admin")) {
    if (!isAdminOrAbove(session?.role) || !refreshed) {
      return clearSessionCookie(NextResponse.redirect(new URL("/admin/login", request.url)));
    }
    return withSessionCookie(NextResponse.next(), refreshed.token, refreshed.maxAgeSeconds);
  }

  if (!refreshed) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return clearSessionCookie(NextResponse.redirect(loginUrl));
  }

  return withSessionCookie(NextResponse.next(), refreshed.token, refreshed.maxAgeSeconds);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
