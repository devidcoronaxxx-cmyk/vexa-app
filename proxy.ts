import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/download",
  "/auth/login",
  "/auth/register",
  "/onboarding",
  "/oautherror",
  "/legal/terms",
  "/legal/privacy",
  "/server-error",
  "/ide",
  "/local",
  "/banned",
  "/credits",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/icons")) return true;
  return false;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The desktop app serves its UI on localhost; users authenticate via the
  // Supabase anon client + localStorage, NOT via vexa_session cookies. Never
  // gate localhost — only the cloud deployment enforces page auth.
  const host = req.headers.get("host") || "";
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("vexa_session")?.value;
  if (!cookie) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icons/|api/).*)"],
};
