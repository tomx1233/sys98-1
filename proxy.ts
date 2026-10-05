import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// Cheap first gate: no session cookie → straight to the login page.
// The real check (is this account still active?) happens in the dashboard layout and in every API route.
export function proxy(req: NextRequest) {
  if (!req.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
