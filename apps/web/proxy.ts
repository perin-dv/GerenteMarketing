import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get("gm_access")?.value);
  const pathname = request.nextUrl.pathname;
  const isProtected = ["/dashboard", "/campaigns", "/goals"].some((route) => pathname.startsWith(route));
  const isLogin = pathname === "/login";

  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isLogin && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/campaigns/:path*", "/goals/:path*"],
};
