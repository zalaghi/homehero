import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, locales } from "./i18n/routing";
import { isAllowedOrigin } from "./server/security/origin";
const localize = createMiddleware({ locales, defaultLocale, localePrefix: "always" });
export default function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    if (!/^\/api\/integrations\/unifi\/protect\/[A-Za-z0-9_-]{43}$/.test(req.nextUrl.pathname) && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !isAllowedOrigin(req.headers)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }
  return localize(req);
}
export const config = { matcher: ["/api/:path*", "/((?!api|_next|.*\\..*).*)"] };
