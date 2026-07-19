import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const AUTH_PAGES = ["/login"];
const PROTECTED_PREFIXES = ["/dashboard", "/onboarding"];

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isAuthed = Boolean(request.auth);

  if (AUTH_PAGES.includes(pathname) && isAuthed) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && !isAuthed) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/onboarding/:path*"],
};
