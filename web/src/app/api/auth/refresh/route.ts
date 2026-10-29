import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { assertSameOrigin } from "@/server/security/csrf";
import {
  getSessionCookieName,
  getSessionCookieOptionsForRequest,
  rotateSessionToken,
} from "@/server/auth/session";
import { logAudit } from "@/server/audit/log";

export async function POST() {
  await assertSameOrigin();
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent") ?? null;
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });

  const rotated = await rotateSessionToken(token);
  if (!rotated) {
    await logAudit({ action: "SESSION_REFRESH_FAIL", ip, userAgent });
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, expiresAt: rotated.expiresAt.toISOString() });
  res.cookies.set(getSessionCookieName(), rotated.token, {
    ...(await getSessionCookieOptionsForRequest()),
    expires: rotated.expiresAt,
  });

  await logAudit({
    actorUserId: rotated.session.userId,
    actorRole: rotated.session.role,
    action: "SESSION_REFRESH_SUCCESS",
    ip,
    userAgent,
  });

  return res;
}
