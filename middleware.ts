import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/api/register"
  ) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth?.user;

  if (pathname === "/login") {
    if (isLoggedIn) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  // Exclude API routes — they protect themselves with await auth() in the handler.
  // Keeping /api/* out of middleware avoids Next.js buffering large POST bodies (file uploads).
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|favicon\\.svg).*)"],
};
