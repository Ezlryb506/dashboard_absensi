import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isPublicPath = (pathname: string) => {
  return pathname.startsWith("/login") || pathname.startsWith("/api/auth");
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }
  const token = request.cookies.get("sb-access-token")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
