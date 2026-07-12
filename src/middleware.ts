import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get("session")?.value;
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET!));
      return NextResponse.next();
    } catch {
      // fall through to redirect
    }
  }
  const login = new URL("/login", req.url);
  if (pathname !== "/") login.searchParams.set("from", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except Next internals and static assets. API routes included.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)"],
};
